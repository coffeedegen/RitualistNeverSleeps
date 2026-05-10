export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteHandle {
  image: HTMLImageElement;
  rect: AtlasRect;
}

interface AtlasManifest {
  image: string;
  sprites: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

export class SpriteRegistry {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly sprites = new Map<string, SpriteHandle>();

  async loadManifest(url: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      return;
    }
    const json = (await res.json()) as AtlasManifest;
    const image = await this.loadImage(this.toPublicUrl(json.image));
    for (const row of json.sprites) {
      this.sprites.set(row.id, {
        image,
        rect: { x: row.x, y: row.y, w: row.w, h: row.h },
      });
    }
  }

  async loadSheet(key: string, url: string): Promise<void> {
    const image = await this.loadImage(url);
    this.images.set(key, image);
  }

  getSheet(key: string): HTMLImageElement | undefined {
    return this.images.get(key);
  }

  getSprite(id: string): SpriteHandle | undefined {
    return this.sprites.get(id);
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const handle = this.sprites.get(id);
    if (handle === undefined) {
      return false;
    }
    ctx.drawImage(
      handle.image,
      handle.rect.x,
      handle.rect.y,
      handle.rect.w,
      handle.rect.h,
      x,
      y,
      w,
      h,
    );
    return true;
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    const existing = this.images.get(url);
    if (existing !== undefined) {
      return existing;
    }
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load sprite image: ${url}`));
      img.src = url;
    });
    this.images.set(url, image);
    return image;
  }

  private toPublicUrl(path: string): string {
    const normalized = path.replace(/^public\//, "");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
}

