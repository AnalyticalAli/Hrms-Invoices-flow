using System;
using System.Drawing;
using System.Drawing.Imaging;

public static class FixLogo {
  public static int Main(string[] args) {
    string srcPath = args[0];
    string outPath = args[1];
    using (Bitmap src = new Bitmap(srcPath)) {
      int w = src.Width, h = src.Height;
      Color[,] px = new Color[w, h];
      for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
          px[x, y] = src.GetPixel(x, y);

      Bitmap dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
      // CORE starts where strong blue text mass begins
      int splitX = w / 2;
      for (int x = 90; x < w - 40; x++) {
        int blue = 0;
        for (int y = 20; y < h - 20; y++) {
          Color c = px[x, y];
          if (c.B > c.R + 25 && c.B > 80) blue++;
        }
        if (blue > 22) { splitX = Math.Max(50, x - 10); break; }
      }

      int navy = 0, clear = 0, color = 0;
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          Color c = px[x, y];
          int lum = (c.R + c.G + c.B) / 3;
          bool isBlue = c.B > c.R + 12 && c.B > 30;
          if (x >= splitX) {
            // CORE side: keep non-black as-is
            if (lum <= 5) { dst.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0)); clear++; }
            else { dst.SetPixel(x, y, Color.FromArgb(255, c.R, c.G, c.B)); color++; }
            continue;
          }
          if (isBlue || lum >= 12) {
            dst.SetPixel(x, y, Color.FromArgb(255, c.R, c.G, c.B));
            color++;
          } else if (lum <= 10 && NearDetail(px, w, h, x, y, 22)) {
            dst.SetPixel(x, y, Color.FromArgb(255, 14, 24, 44));
            navy++;
          } else {
            dst.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
            clear++;
          }
        }
      }
      Console.WriteLine("splitX=" + splitX);
      dst.Save(outPath, ImageFormat.Png);
      dst.Dispose();
      Console.WriteLine("color=" + color + " navy=" + navy + " clear=" + clear);
    }
    return 0;
  }

  static bool NearDetail(Color[,] px, int w, int h, int x, int y, int r) {
    for (int dy = -r; dy <= r; dy++) {
      for (int dx = -r; dx <= r; dx++) {
        int nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        Color c = px[nx, ny];
        int lum = (c.R + c.G + c.B) / 3;
        if (c.B > c.R + 12 && c.B > 30) return true;
        if (lum >= 14) return true;
      }
    }
    return false;
  }
}
