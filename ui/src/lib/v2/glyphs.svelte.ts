export type IconNode = [string, Record<string, string>][];

class Glyphs {
  nodes = $state.raw<Record<string, IconNode>>({});
  names = $state.raw<string[]>([]);
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= import("./lucide.json").then((module) => {
      this.nodes = module.default as unknown as Record<string, IconNode>;
      this.names = Object.keys(this.nodes).sort();
    });
    return this.loading;
  }
}

export const glyphs = new Glyphs();
