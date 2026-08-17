const g = globalThis as any;

if (!g.DOMMatrix) {
  class DOMMatrixShim {
    a: number; b: number; c: number; d: number; e: number; f: number;

    constructor(init?: any) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (init === undefined || init === null) return;
      if (typeof init === "string") {
        const m = init.match(/matrix\(\s*([^)]+)\s*\)/);
        if (m) {
          const parts = m[1].split(/[\s,]+/).map(Number);
          if (parts.length === 6) this.setValues(...parts);
        }
        return;
      }
      if (Array.isArray(init) || ArrayBuffer.isView(init)) {
        const v = Array.from(init as number[]);
        if (v.length >= 6) this.setValues(v[0], v[1], v[2], v[3], v[4], v[5]);
        return;
      }
      if (typeof init === "object") {
        this.a = Number(init.a ?? 1); this.b = Number(init.b ?? 0);
        this.c = Number(init.c ?? 0); this.d = Number(init.d ?? 1);
        this.e = Number(init.e ?? 0); this.f = Number(init.f ?? 0);
      }
    }

    private setValues(...args: number[]) {
      this.a = args[0] ?? 1; this.b = args[1] ?? 0; this.c = args[2] ?? 0;
      this.d = args[3] ?? 1; this.e = args[4] ?? 0; this.f = args[5] ?? 0;
    }

    get isIdentity() {
      return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
    }

    get is2D() { return true; }

    get m11() { return this.a; } set m11(v: number) { this.a = v; }
    get m12() { return this.b; } set m12(v: number) { this.b = v; }
    get m21() { return this.c; } set m21(v: number) { this.c = v; }
    get m22() { return this.d; } set m22(v: number) { this.d = v; }
    get m41() { return this.e; } set m41(v: number) { this.e = v; }
    get m42() { return this.f; } set m42(v: number) { this.f = v; }

    private clone() { return new DOMMatrixShim([this.a, this.b, this.c, this.d, this.e, this.f]); }

    multiply(other: any) { return this.clone().multiplySelf(other); }
    preMultiply(other: any) { return this.clone().preMultiplySelf(other); }
    multiplySelf(other: any) {
      const o = new DOMMatrixShim(other);
      const { a, b, c, d, e, f } = this;
      this.a = a * o.a + c * o.b;
      this.b = b * o.a + d * o.b;
      this.c = a * o.c + c * o.d;
      this.d = b * o.c + d * o.d;
      this.e = a * o.e + c * o.f + e;
      this.f = b * o.e + d * o.f + f;
      return this;
    }
    preMultiplySelf(other: any) {
      const o = new DOMMatrixShim(other);
      const { a, b, c, d, e, f } = o;
      const { a: a2, b: b2, c: c2, d: d2, e: e2, f: f2 } = this;
      this.a = a * a2 + c * b2;
      this.b = b * a2 + d * b2;
      this.c = a * c2 + c * d2;
      this.d = b * c2 + d * d2;
      this.e = a * e2 + c * f2 + e;
      this.f = b * e2 + d * f2 + f;
      return this;
    }
    translate(tx = 0, ty = 0) { return this.clone().translateSelf(tx, ty); }
    translateSelf(tx = 0, ty = 0) {
      this.e += tx * this.a + ty * this.c;
      this.f += tx * this.b + ty * this.d;
      return this;
    }
    scale(sx = 1, sy = sx) { return this.clone().scaleSelf(sx, sy); }
    scaleSelf(sx = 1, sy = sx) {
      this.a *= sx; this.b *= sy; this.c *= sx; this.d *= sy;
      return this;
    }
    rotate(rot = 0) { return this.clone().rotateSelf(rot); }
    rotateSelf(rot = 0) {
      const rad = (rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return this.multiplySelf({ a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
    }
    rotateAxisAngle() { return this.clone(); }
    rotateAxisAngleSelf() { return this; }
    skewX(sx = 0) { return this.clone().skewXSelf(sx); }
    skewXSelf(sx = 0) {
      const tan = Math.tan((sx * Math.PI) / 180);
      return this.multiplySelf({ a: 1, b: 0, c: tan, d: 1, e: 0, f: 0 });
    }
    skewY(sy = 0) { return this.clone().skewYSelf(sy); }
    skewYSelf(sy = 0) {
      const tan = Math.tan((sy * Math.PI) / 180);
      return this.multiplySelf({ a: 1, b: tan, c: 0, d: 1, e: 0, f: 0 });
    }
    invertSelf() {
      const det = this.a * this.d - this.b * this.c;
      if (det === 0) return this;
      const { a, b, c, d, e, f } = this;
      this.a = d / det; this.b = -b / det; this.c = -c / det; this.d = a / det;
      this.e = (c * f - d * e) / det;
      this.f = (b * e - a * f) / det;
      return this;
    }
    inverse() { return this.clone().invertSelf(); }
    setMatrixValue(value: any) {
      const m = new DOMMatrixShim(value);
      this.a = m.a; this.b = m.b; this.c = m.c; this.d = m.d; this.e = m.e; this.f = m.f;
      return this;
    }
    transformPoint(point: any) {
      return {
        x: this.a * (point.x ?? 0) + this.c * (point.y ?? 0) + this.e,
        y: this.b * (point.x ?? 0) + this.d * (point.y ?? 0) + this.f,
        z: 0, w: 1,
      };
    }
    toFloat32Array() { return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]); }
    toFloat64Array() { return new Float64Array([this.a, this.b, this.c, this.d, this.e, this.f]); }
    toString() {
      return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }

    static fromMatrix(other: any) { return new DOMMatrixShim(other); }
    static fromFloat32Array(v: any) { return new DOMMatrixShim(Array.from(v as any)); }
    static fromFloat64Array(v: any) { return new DOMMatrixShim(Array.from(v as any)); }
  }
  g.DOMMatrix = DOMMatrixShim;
}

if (!g.ImageData) {
  class ImageDataShim {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(width: number, height: number, data?: Uint8ClampedArray) {
      this.width = width; this.height = height;
      this.data = data ?? new Uint8ClampedArray(width * height * 4);
    }
  }
  g.ImageData = ImageDataShim;
}

if (!g.Path2D) {
  class Path2DShim {
    constructor() {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect(x: number, y: number, w: number, h: number) { void x; void y; void w; void h; }
    roundRect() {}
  }
  g.Path2D = Path2DShim;
}