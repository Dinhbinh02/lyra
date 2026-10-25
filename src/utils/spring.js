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
