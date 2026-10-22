// WebGL байгаа эсэхийг шалгана (FR-B9, §8.6, D57). 3D санг импортлохгүй — үндсэн bundle-д хөнгөн хэвээр.

/** Түр canvas дээр WebGL2, дараа нь WebGL1 context авахыг оролдоно. Алдаа гарвал `false`. */
export function detectWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // Шалгалтын context-ийг тэр даруй суллана — хөтөч нэг зэрэг байх context-ийн тоог хязгаарладаг
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
