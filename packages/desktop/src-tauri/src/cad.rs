use serde::Serialize;
use specta::Type;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};
use tokio::process::Command;

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DxfPoint {
    x: f64,
    y: f64,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DxfLayer {
    name: String,
    color: i16,
    visible: bool,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DxfBounds {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DxfEntity {
    Line {
        id: String,
        layer: String,
        color: i16,
        start: DxfPoint,
        end: DxfPoint,
    },
    Circle {
        id: String,
        layer: String,
        color: i16,
        center: DxfPoint,
        radius: f64,
    },
    Arc {
        id: String,
        layer: String,
        color: i16,
        center: DxfPoint,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    },
    Polyline {
        id: String,
        layer: String,
        color: i16,
        points: Vec<DxfPoint>,
        closed: bool,
    },
    Text {
        id: String,
        layer: String,
        color: i16,
        insert: DxfPoint,
        value: String,
        height: f64,
    },
}

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DxfDocument {
    source_path: String,
    layers: Vec<DxfLayer>,
    entities: Vec<DxfEntity>,
    bounds: DxfBounds,
    total_entity_count: u32,
}

#[derive(Clone)]
struct Pair {
    code: i32,
    value: String,
}

#[derive(Default)]
struct Bounds {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
    ready: bool,
}

impl Bounds {
    fn include(&mut self, point: &DxfPoint) {
        if !self.ready {
            self.min_x = point.x;
            self.min_y = point.y;
            self.max_x = point.x;
            self.max_y = point.y;
            self.ready = true;
            return;
        }

        self.min_x = self.min_x.min(point.x);
        self.min_y = self.min_y.min(point.y);
        self.max_x = self.max_x.max(point.x);
        self.max_y = self.max_y.max(point.y);
    }

    fn include_circle(&mut self, center: &DxfPoint, radius: f64) {
        self.include(&DxfPoint {
            x: center.x - radius,
            y: center.y - radius,
        });
        self.include(&DxfPoint {
            x: center.x + radius,
            y: center.y + radius,
        });
    }

    fn finish(self) -> DxfBounds {
        if self.ready {
            return DxfBounds {
                min_x: self.min_x,
                min_y: self.min_y,
                max_x: self.max_x,
                max_y: self.max_y,
            };
        }

        DxfBounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 1.0,
            max_y: 1.0,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn parse_dxf(path: String) -> Result<DxfDocument, String> {
    if !Path::new(&path).exists() {
        return Err(format!("DXF 文件不存在：{path}"));
    }

    let text = std::fs::read_to_string(&path).map_err(|err| format!("读取 DXF 失败：{err}"))?;
    Ok(parse_text(&path, &text))
}

#[tauri::command]
#[specta::specta]
pub async fn convert_dwg_to_dxf(path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err(format!("DWG 文件不存在：{path}"));
    }

    let out = src.with_extension("dxf");
    let result = Command::new("dwg2dxf")
        .arg(&src)
        .arg(&out)
        .output()
        .await
        .map_err(|err| format!("启动 dwg2dxf 失败：{err}"))?;

    if result.status.success() && out.exists() {
        return Ok(out.to_string_lossy().to_string());
    }

    let stderr = String::from_utf8_lossy(&result.stderr);
    Err(format!(
        "DWG 转 DXF 失败。请安装 dwg2dxf 或 ODA File Converter 后重试。{stderr}"
    ))
}

fn parse_text(path: &str, text: &str) -> DxfDocument {
    let pairs = pairs(text);
    let layers = parse_layers(&pairs);
    let map = layers
        .iter()
        .map(|layer| (layer.name.clone(), layer.color))
        .collect::<BTreeMap<_, _>>();
    let (entities, names, bounds, total) = parse_entities(&pairs, &map);
    let layer_names = layers.iter().map(|layer| layer.name.clone()).collect::<BTreeSet<_>>();
    let missing = names
        .difference(&layer_names)
        .map(|name| DxfLayer {
            name: name.clone(),
            color: 7,
            visible: true,
        })
        .collect::<Vec<_>>();

    DxfDocument {
        source_path: path.to_string(),
        layers: layers.into_iter().chain(missing).collect(),
        entities,
        bounds: bounds.finish(),
        total_entity_count: total as u32,
    }
}

fn pairs(text: &str) -> Vec<Pair> {
    let mut lines = text.lines();
    let mut pairs = Vec::new();

    while let Some(code) = lines.next() {
        let Some(value) = lines.next() else {
            break;
        };
        let Ok(code) = code.trim().parse::<i32>() else {
            continue;
        };
        pairs.push(Pair {
            code,
            value: value.trim().to_string(),
        });
    }

    pairs
}

fn parse_layers(pairs: &[Pair]) -> Vec<DxfLayer> {
    pairs
        .iter()
        .enumerate()
        .filter(|(_, pair)| pair.code == 0 && pair.value.eq_ignore_ascii_case("LAYER"))
        .filter_map(|(index, _)| {
            let chunk = collect_until_zero(pairs, index + 1);
            let name = text(&chunk, 2)?;
            Some(DxfLayer {
                name,
                color: number::<i16>(&chunk, 62).unwrap_or(7).abs(),
                visible: number::<i16>(&chunk, 62).map(|color| color >= 0).unwrap_or(true),
            })
        })
        .collect()
}

fn parse_entities(
    pairs: &[Pair],
    layers: &BTreeMap<String, i16>,
) -> (Vec<DxfEntity>, BTreeSet<String>, Bounds, usize) {
    let mut entities = Vec::new();
    let mut names = BTreeSet::new();
    let mut bounds = Bounds::default();
    let mut total = 0;
    let mut index = 0;

    while index < pairs.len() {
        if !is_entity_start(&pairs[index]) {
            index += 1;
            continue;
        }

        let kind = pairs[index].value.to_ascii_uppercase();
        let end = if kind == "POLYLINE" {
            find_seqend(pairs, index + 1)
        } else {
            find_next_zero(pairs, index + 1)
        };
        let chunk = &pairs[index..end];
        total += 1;

        if let Some(entity) = parse_entity(&kind, chunk, layers, total) {
            include_entity(&mut bounds, &entity);
            names.insert(layer(&entity));
            entities.push(entity);
        }

        index = end;
    }

    (entities, names, bounds, total)
}

fn is_entity_start(pair: &Pair) -> bool {
    pair.code == 0
        && matches!(
            pair.value.to_ascii_uppercase().as_str(),
            "LINE" | "CIRCLE" | "ARC" | "TEXT" | "MTEXT" | "LWPOLYLINE" | "POLYLINE"
        )
}

fn parse_entity(
    kind: &str,
    chunk: &[Pair],
    layers: &BTreeMap<String, i16>,
    index: usize,
) -> Option<DxfEntity> {
    let layer = text(chunk, 8).unwrap_or_else(|| "0".to_string());
    let color = color(chunk, layers, &layer);
    let id = text(chunk, 5).unwrap_or_else(|| format!("entity-{index}"));

    match kind {
        "LINE" => Some(DxfEntity::Line {
            id,
            layer,
            color,
            start: point(chunk, 10, 20)?,
            end: point(chunk, 11, 21)?,
        }),
        "CIRCLE" => Some(DxfEntity::Circle {
            id,
            layer,
            color,
            center: point(chunk, 10, 20)?,
            radius: number(chunk, 40).unwrap_or(0.0),
        }),
        "ARC" => Some(DxfEntity::Arc {
            id,
            layer,
            color,
            center: point(chunk, 10, 20)?,
            radius: number(chunk, 40).unwrap_or(0.0),
            start_angle: number(chunk, 50).unwrap_or(0.0),
            end_angle: number(chunk, 51).unwrap_or(360.0),
        }),
        "TEXT" | "MTEXT" => Some(DxfEntity::Text {
            id,
            layer,
            color,
            insert: point(chunk, 10, 20)?,
            value: text(chunk, 1).unwrap_or_default(),
            height: number(chunk, 40).unwrap_or(1.0),
        }),
        "LWPOLYLINE" => Some(DxfEntity::Polyline {
            id,
            layer,
            color,
            points: lightweight_points(chunk),
            closed: number::<i32>(chunk, 70).map(|flag| flag & 1 == 1).unwrap_or(false),
        }),
        "POLYLINE" => Some(DxfEntity::Polyline {
            id,
            layer,
            color,
            points: vertex_points(chunk),
            closed: number::<i32>(chunk, 70).map(|flag| flag & 1 == 1).unwrap_or(false),
        }),
        _ => None,
    }
}

fn include_entity(bounds: &mut Bounds, entity: &DxfEntity) {
    match entity {
        DxfEntity::Line { start, end, .. } => {
            bounds.include(start);
            bounds.include(end);
        }
        DxfEntity::Circle { center, radius, .. } | DxfEntity::Arc { center, radius, .. } => {
            bounds.include_circle(center, *radius);
        }
        DxfEntity::Polyline { points, .. } => points.iter().for_each(|point| bounds.include(point)),
        DxfEntity::Text { insert, .. } => bounds.include(insert),
    }
}

fn layer(entity: &DxfEntity) -> String {
    match entity {
        DxfEntity::Line { layer, .. }
        | DxfEntity::Circle { layer, .. }
        | DxfEntity::Arc { layer, .. }
        | DxfEntity::Polyline { layer, .. }
        | DxfEntity::Text { layer, .. } => layer.clone(),
    }
}

fn collect_until_zero(pairs: &[Pair], start: usize) -> Vec<Pair> {
    pairs[start..find_next_zero(pairs, start)].to_vec()
}

fn find_next_zero(pairs: &[Pair], start: usize) -> usize {
    pairs[start..]
        .iter()
        .position(|pair| pair.code == 0)
        .map(|offset| start + offset)
        .unwrap_or(pairs.len())
}

fn find_seqend(pairs: &[Pair], start: usize) -> usize {
    pairs[start..]
        .iter()
        .position(|pair| pair.code == 0 && pair.value.eq_ignore_ascii_case("SEQEND"))
        .map(|offset| start + offset + 1)
        .unwrap_or(pairs.len())
}

fn text(pairs: &[Pair], code: i32) -> Option<String> {
    pairs
        .iter()
        .find(|pair| pair.code == code)
        .map(|pair| pair.value.clone())
}

fn number<T: std::str::FromStr>(pairs: &[Pair], code: i32) -> Option<T> {
    pairs
        .iter()
        .find(|pair| pair.code == code)
        .and_then(|pair| pair.value.parse::<T>().ok())
}

fn point(pairs: &[Pair], x: i32, y: i32) -> Option<DxfPoint> {
    Some(DxfPoint {
        x: number(pairs, x)?,
        y: number(pairs, y)?,
    })
}

fn color(pairs: &[Pair], layers: &BTreeMap<String, i16>, layer: &str) -> i16 {
    let own = number::<i16>(pairs, 62).unwrap_or(256);
    if own != 0 && own != 256 {
        return own.abs();
    }
    layers.get(layer).copied().unwrap_or(7).abs()
}

fn lightweight_points(pairs: &[Pair]) -> Vec<DxfPoint> {
    let mut x = None;
    let mut points = Vec::new();

    for pair in pairs {
        if pair.code == 10 {
            x = pair.value.parse::<f64>().ok();
            continue;
        }

        if pair.code == 20
            && let Some(x) = x.take()
            && let Ok(y) = pair.value.parse::<f64>()
        {
            points.push(DxfPoint { x, y });
        }
    }

    points
}

fn vertex_points(pairs: &[Pair]) -> Vec<DxfPoint> {
    pairs
        .split(|pair| pair.code == 0 && pair.value.eq_ignore_ascii_case("VERTEX"))
        .filter_map(|chunk| point(chunk, 10, 20))
        .collect()
}
