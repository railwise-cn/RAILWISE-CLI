import * as math from 'mathjs';

export interface Point2D {
  id: string;
  x: number;
  y: number;
}

export interface ObsAngle {
  from: string;
  to: string;
  angle: number; // Radian
}

export interface ObsDistance {
  from: string;
  to: string;
  distance: number;
}

/**
 * Simplified 2D Least Squares Adjustment Engine
 * Aimed to demonstrate the core capability needed for CPIII
 */
export class LeastSquaresAdjustment {
  private knownPoints: Map<string, Point2D> = new Map();
  private unknownPoints: Map<string, Point2D> = new Map(); // Initial approximations
  
  private obsAngles: ObsAngle[] = [];
  private obsDistances: ObsDistance[] = [];

  addKnownPoint(id: string, x: number, y: number) {
    this.knownPoints.set(id, { id, x, y });
  }

  addUnknownPoint(id: string, approxX: number, approxY: number) {
    this.unknownPoints.set(id, { id, x: approxX, y: approxY });
  }

  addObservationAngle(from: string, to: string, angleRadian: number) {
    this.obsAngles.push({ from, to, angle: angleRadian });
  }

  addObservationDistance(from: string, to: string, distance: number) {
    this.obsDistances.push({ from, to, distance });
  }

  private getPoint(id: string): Point2D {
    if (this.knownPoints.has(id)) return this.knownPoints.get(id)!;
    if (this.unknownPoints.has(id)) return this.unknownPoints.get(id)!;
    throw new Error(`Point ${id} not found`);
  }

  /**
   * Run one iteration of Least Squares
   * x = (A^T * P * A)^-1 * A^T * P * L
   */
  public solveIteration(): Map<string, Point2D> {
    const unknownIds = Array.from(this.unknownPoints.keys());
    const numUnknowns = unknownIds.length * 2; // dx, dy for each
    const numObs = this.obsDistances.length + this.obsAngles.length;
    
    // A matrix (Design matrix): numObs x numUnknowns
    const A = math.zeros(numObs, numUnknowns) as math.Matrix;
    // L matrix (Misclosure vector): numObs x 1
    const L = math.zeros(numObs, 1) as math.Matrix;
    
    let rowIndex = 0;

    // Fill observation equations for Distances
    for (let i = 0; i < this.obsDistances.length; i++) {
      const obs = this.obsDistances[i];
      const p1 = this.getPoint(obs.from);
      const p2 = this.getPoint(obs.to);
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const calcDist = Math.sqrt(dx * dx + dy * dy);
      
      L.set([rowIndex, 0], obs.distance - calcDist);
      
      if (this.unknownPoints.has(obs.from)) {
        const idx = unknownIds.indexOf(obs.from) * 2;
        A.set([rowIndex, idx], -dx / calcDist);
        A.set([rowIndex, idx + 1], -dy / calcDist);
      }
      
      if (this.unknownPoints.has(obs.to)) {
        const idx = unknownIds.indexOf(obs.to) * 2;
        A.set([rowIndex, idx], dx / calcDist);
        A.set([rowIndex, idx + 1], dy / calcDist);
      }
      rowIndex++;
    }

    // Fill observation equations for Angles (Directions)
    for (let i = 0; i < this.obsAngles.length; i++) {
      const obs = this.obsAngles[i];
      const p1 = this.getPoint(obs.from);
      const p2 = this.getPoint(obs.to);
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const calcDistSq = dx * dx + dy * dy;
      let calcAngle = Math.atan2(dy, dx);
      if (calcAngle < 0) calcAngle += 2 * Math.PI;

      let angleDiff = obs.angle - calcAngle;
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      L.set([rowIndex, 0], angleDiff);

      // Coefficients for angle (radians per meter)
      const c_x1 = dy / calcDistSq;
      const c_y1 = -dx / calcDistSq;
      const c_x2 = -dy / calcDistSq;
      const c_y2 = dx / calcDistSq;

      if (this.unknownPoints.has(obs.from)) {
        const idx = unknownIds.indexOf(obs.from) * 2;
        A.set([rowIndex, idx], c_x1);
        A.set([rowIndex, idx + 1], c_y1);
      }
      
      if (this.unknownPoints.has(obs.to)) {
        const idx = unknownIds.indexOf(obs.to) * 2;
        A.set([rowIndex, idx], c_x2);
        A.set([rowIndex, idx + 1], c_y2);
      }
      rowIndex++;
    }

    // Weight matrix P is identity for now
    const AT = math.transpose(A);
    const N = math.multiply(AT, A) as math.Matrix;
    const U = math.multiply(AT, L) as math.Matrix;
    
    // Add Free Network constraints (Rank Defect) if needed
    // Typically for CPIII, N is singular if not enough known points exist.
    // In that case, we must add Moore-Penrose pseudo-inverse or inner constraints.
    // For simplicity, we assume pseudo-inverse is used or enough constraints exist.
    let x;
    try {
      x = math.lusolve(N, U) as math.Matrix;
    } catch (e) {
      // Fallback: If matrix is singular, use pseudo-inverse (pinv)
      // mathjs does not have native pinv, but we can do a Tikhonov regularization (Ridge regression)
      // N_reg = N + lambda * I
      const I = math.identity(numUnknowns) as math.Matrix;
      const lambda = 1e-9;
      const N_reg = math.add(N, math.multiply(lambda, I)) as math.Matrix;
      x = math.lusolve(N_reg, U) as math.Matrix;
    }
    
    // Update approximations
    const result = new Map<string, Point2D>();
    for (let i = 0; i < unknownIds.length; i++) {
      const id = unknownIds[i];
      const p = this.unknownPoints.get(id)!;
      const dx_val = Number(x.get([i * 2, 0]));
      const dy_val = Number(x.get([i * 2 + 1, 0]));
      result.set(id, { id, x: p.x + dx_val, y: p.y + dy_val });
      // Update in place for next iteration
      this.unknownPoints.set(id, result.get(id)!);
    }
    
    return result;
  }
}
