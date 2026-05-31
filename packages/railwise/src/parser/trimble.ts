import type { StationRecord, Observation } from "./gsi.js"

export class TrimbleDatParser {
  static parse(text: string): StationRecord[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const stations: StationRecord[] = []
    let currentStation: StationRecord | null = null

    for (const line of lines) {
      const parts = line.split(/[,\s]+/)
      
      if (parts[0] === 'ST' || parts[0] === 'Station') {
        if (currentStation) stations.push(currentStation)
        
        const id = parts[1] || 'UNKNOWN'
        const ih = parseFloat(parts[2] || '0')
        
        currentStation = {
          stationId: id,
          instrumentHeight: ih,
          observations: []
        }
      } 
      else if (parts[0] === 'SS' || parts[0] === 'Obs') {
        if (!currentStation) continue
        
        const targetId = parts[1] || 'UNKNOWN'
        const hz = parseFloat(parts[2] || '0')
        const v = parseFloat(parts[3] || '0')
        const sd = parseFloat(parts[4] || '0')
        const rh = parseFloat(parts[5] || '0')
        
        const obs: Observation = {
          targetId,
          horizontalAngle: hz,
          verticalAngle: v,
        }
        
        if (sd > 0) obs.slopeDistance = sd
        if (rh > 0) obs.reflectorHeight = rh
        
        currentStation.observations.push(obs)
      }
    }
    
    if (currentStation) {
      stations.push(currentStation)
    }
    
    return stations
  }
}
