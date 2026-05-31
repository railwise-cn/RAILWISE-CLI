/**
 * Leica GSI (Geo Serial Interface) Parser
 * Translates raw total station data into observation records
 */

export interface Observation {
  targetId: string;
  horizontalAngle: number; // Decimal degrees or Gon
  verticalAngle: number;   // Decimal degrees or Gon
  slopeDistance?: number;  // Meters
  reflectorHeight?: number;// Meters
}

export interface StationRecord {
  stationId: string;
  instrumentHeight: number;
  observations: Observation[];
}

export class GsiParser {
  /**
   * Parse a block of GSI 8 or 16-character format lines
   */
  static parse(gsiText: string): StationRecord[] {
    const lines = gsiText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const stations: StationRecord[] = [];
    let currentStation: StationRecord | null = null;

    for (const line of lines) {
      const blocks = line.split(/\s+/);
      let pointId = '';
      let hz = 0, v = 0, sd = 0, rh = 0;
      let isStationRecord = false;
      let hasDistance = false;

      for (const block of blocks) {
        if (block.length < 7) continue;
        const wi = block.substring(0, 2); // Word Index
        
        let valueStr = block.substring(7).trim(); // Value starts after standard format info
        
        // Remove trailing signs or non-numeric for parsing
        valueStr = valueStr.replace(/[^\d.-]/g, '');
        const value = parseInt(valueStr, 10);
        if (isNaN(value)) continue;

        switch (wi) {
          case '11': // Point ID
            pointId = block.substring(7).replace(/^0+/, ''); // Strip leading zeros
            if (pointId === '') pointId = '0';
            break;
          case '84': // Station Point ID
            isStationRecord = true;
            pointId = block.substring(7).replace(/^0+/, '');
            break;
          case '87': // Reflector Height
            rh = value / 10000.0;
            break;
          case '88': // Instrument Height
            rh = value / 10000.0; // Same index block often used
            break;
          case '21': // Horizontal Angle (Hz)
            hz = value / 100000.0; // Assuming 5 decimal places precision (gon/deg)
            break;
          case '22': // Vertical Angle (V)
            v = value / 100000.0; // Assuming 5 decimal places precision (gon/deg)
            break;
          case '31': // Slope Distance (SD)
            hasDistance = true;
            sd = value / 10000.0; // Assuming mm precision scaled
            break;
        }
      }

      if (isStationRecord) {
        if (currentStation) stations.push(currentStation);
        currentStation = {
          stationId: pointId,
          instrumentHeight: rh,
          observations: []
        };
      } else if (currentStation && pointId) {
        const obs: Observation = {
          targetId: pointId,
          horizontalAngle: hz,
          verticalAngle: v,
        };
        if (hasDistance) obs.slopeDistance = sd;
        if (rh > 0) obs.reflectorHeight = rh;
        
        currentStation.observations.push(obs);
      }
    }

    if (currentStation) {
      stations.push(currentStation);
    }

    return stations;
  }
}
