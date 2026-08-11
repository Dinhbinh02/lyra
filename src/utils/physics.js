export class Spring {
    constructor(initial, dampingRatio, frequency) {
        if (dampingRatio * frequency < 0) {
            throw new Error("Spring does not converge.");
        }
        this.dampingRatio = dampingRatio;
        this.frequency = frequency;
        this.position = initial;
        this.final = initial;
        this.velocity = 0;
    }

    update(deltaTime) {
        const radialFrequency = this.frequency * Math.PI * 2;
        const offset = this.position - this.final;
        const decay = Math.exp(-this.dampingRatio * radialFrequency * deltaTime);

        let newPosition, newVelocity;
        if (this.dampingRatio === 1) {
            newPosition = (offset * (1 + radialFrequency * deltaTime) + this.velocity * deltaTime) * decay + this.final;
            newVelocity = (this.velocity * (1 - radialFrequency * deltaTime) - offset * (radialFrequency * radialFrequency * deltaTime)) * decay;
        } else if (this.dampingRatio < 1) {
            const c = Math.sqrt(1 - this.dampingRatio * this.dampingRatio);
            const cosVal = Math.cos(radialFrequency * c * deltaTime);
            const sinVal = Math.sin(radialFrequency * c * deltaTime);
            const z = c > 1e-4 ? sinVal / c : radialFrequency * deltaTime;
            const y = (radialFrequency * c) > 1e-4 ? sinVal / (radialFrequency * c) : deltaTime;

            newPosition = (offset * (cosVal + this.dampingRatio * z) + this.velocity * y) * decay + this.final;
            newVelocity = (this.velocity * (cosVal - z * this.dampingRatio) - offset * (z * radialFrequency)) * decay;
        } else {
            const c = Math.sqrt(this.dampingRatio * this.dampingRatio - 1);
            const r1 = -radialFrequency * (this.dampingRatio - c);
            const r2 = -radialFrequency * (this.dampingRatio + c);
            const co2 = (this.velocity - offset * r1) / (2 * radialFrequency * c);
            const co1 = offset - co2;
            const e1 = co1 * Math.exp(r1 * deltaTime);
            const e2 = co2 * Math.exp(r2 * deltaTime);

            newPosition = e1 + e2 + this.final;
            newVelocity = e1 * r1 + e2 * r2;
        }

        this.position = newPosition;
        this.velocity = newVelocity;
        return newPosition;
    }
}

export class LyricSpring {
    constructor(startPos, damping, frequency, goal = startPos) {
        this.dampingRatio = damping;
        this.frequency = frequency;
        this.goal = goal;
        this.position = startPos;
        this.velocity = 0;
    }

    step(dt) {
        const tau = Math.PI * 2;
        const d = this.dampingRatio;
        const f = this.frequency * tau;
        const g = this.goal;
        const x = this.position;
        const v = this.velocity;

        if (dt <= 0) return x;

        if (d === 1) {
            const q = Math.exp(-f * dt);
            const w = dt * q;
            const c0 = q + w * f;
            const c2 = q - w * f;
            const c3 = w * f * f;
            const goalDist = x - g;
            this.position = goalDist * c0 + v * w + g;
            this.velocity = v * c2 - goalDist * c3;
        } else if (d < 1) {
            const fdt = f * dt;
            const q = Math.exp(-d * fdt);
            const c = Math.sqrt(1 - d * d);
            const cfdt = c * fdt;
            const cosVal = Math.cos(cfdt);
            const sinVal = Math.sin(cfdt);
            const z = sinVal / c;
            const goalDist = x - g;
            const c0 = q * (cosVal + d * z);
            const c1 = q * z / f;
            const c2 = q * (cosVal - d * z);
            const c3 = q * z * f;
            this.position = goalDist * c0 + v * c1 + g;
            this.velocity = v * c2 - goalDist * c3;
        } else {
            const c = Math.sqrt(d * d - 1);
            const r1 = -f * (d - c);
            const r2 = -f * (d + c);
            const goalDist = x - g;
            const c2 = (v - r1 * goalDist) / (r2 - r1);
            const c1 = goalDist - c2;
            const e1 = Math.exp(r1 * dt);
            const e2 = Math.exp(r2 * dt);
            this.position = c1 * e1 + c2 * e2 + g;
            this.velocity = c1 * r1 * e1 + c2 * r2 * e2;
        }
        return this.position;
    }
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function getScaleTarget(t) {
    if (t <= 0.7) {
        return lerp(0.92, 1.18, t / 0.7);
    } else {
        return lerp(1.18, 1.0, (t - 0.7) / 0.3);
    }
}

export function getYOffsetTarget(t) {
    if (t <= 0.9) {
        return lerp(0.05, -0.18, t / 0.9);
    } else {
        return lerp(-0.18, 0.0, (t - 0.9) / 0.1);
    }
}

export function getGlowTarget(t) {
    if (t <= 0.15) {
        return lerp(0.0, 1.0, t / 0.15);
    } else if (t <= 0.6) {
        return 1.0;
    } else {
        return lerp(1.0, 0.0, (t - 0.6) / 0.4);
    }
}
