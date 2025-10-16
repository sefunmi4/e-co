# Texture Asset Guidelines

The Ether Pod frontend ships texture assets from `apps/web/ether-pod/public/assets`. To keep download sizes manageable and ensure that runtime loading stays fast, the build pipeline validates textures for two things:

1. **Resolution** – every PNG, JPEG, or WebP texture must be 2048 pixels or smaller on both axes.
2. **KTX2 companions** – every texture must ship alongside a transcodable `.ktx2` version with the same filename.

If either rule is violated, CI and local builds will fail with an actionable error that lists the offending files. Use the steps below to resolve the failures.

## Resizing overscale textures

1. Open the source file in your preferred art package (e.g. Photoshop, Affinity, GIMP).
2. Resize the canvas so that the largest dimension is **2048 px or below**. Preserve the aspect ratio to avoid stretching.
3. Export the updated texture, replacing the file in `apps/web/ether-pod/public/assets`.

> Tip: If you need a larger source file for the asset catalogue, keep it in your working directory and only commit the downscaled export.

## Generating `.ktx2` companions

We use the [Khronos `toktx`](https://github.khronos.org/KTX-Software/) encoder to generate `.ktx2` files that can be transcoded by WebGL at runtime. Install the tooling once:

```bash
brew install toktx    # macOS
sudo apt-get install ktx-tools   # Ubuntu / Debian
```

Then generate a `.ktx2` for each texture. Replace `texture.png` with your file name:

```bash
toktx --2d --bcmp texture.ktx2 texture.png
```

Commit both the source texture and its `.ktx2` companion. Re-run the build or `npm run check:assets -w apps/web/ether-pod` to confirm that validation passes.

## Running the validator locally

The validator runs automatically as part of `npm run build -w apps/web/ether-pod`, in CI, and is also available as a standalone script:

```bash
npm run check:assets -w apps/web/ether-pod
```

Running the command before you open a PR will catch oversized or missing KTX2 textures early.
