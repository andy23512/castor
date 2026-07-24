# Castor

See a CharaChorder device at its real, physical size on a flat screen — before you buy one.

Photos and spec sheets do not tell you how a device feels in your hands. Castor renders the
CharaChorder Two model at 1:1 scale in the browser: you calibrate your screen once by matching a
bank card, and from then on what you see is what you would hold.

**[Try it &raquo;](https://andy23512.github.io/castor/)**

## Calibrating your screen

A browser cannot know how large your screen physically is, so Castor asks once. The calibration
dialog opens on your first visit, and a badge stays in the corner until you confirm it.

1. Hold any ID-1 card against the screen — a bank card, driving licence or most ID cards. The
   format is 85.60 x 53.98 mm worldwide, which makes it a reliable ruler.
2. Drag the corner handle of the on-screen rectangle, or use the slider, until it matches the card.
   On a phone the card is shown upright, because a card is wider than a phone screen.
3. Cross-check against the inch and centimetre rulers below it, then press **Done**.

No card at hand? The advanced panel derives the same value from your logical resolution, screen
size and browser zoom. It is less accurate, because the advertised screen size is usually rounded
(a "24 inch" panel is often 23.8 inch).

The calibration is stored in `localStorage`, per browser. Calibrate again if you change the browser
zoom or the display scaling, or if you move the window to a monitor with a different pixel density.

## How it works

Everything is derived from one number: `pixelsPerInch`, how many CSS pixels one inch of your screen
is.

- The scene uses an orthographic camera whose frustum is sized in metres:
  `visible width = clientWidth / ppi * 0.0254`. Nothing scales the model itself.
- The model (`static/charachorder-models`) is modelled in metres, straight from the CharaChorder
  CAD sources, so its dimensions are the physical ones.
- The background grid is 1 cm per cell.

## Development

Requires Node 22+ and yarn.

```bash
yarn install
```

```bash
yarn start
```

The dev server runs at http://localhost:8315.

```bash
yarn test
```

```bash
yarn build
```

Source layout:

| Path                            | Contents                                            |
| ------------------------------- | --------------------------------------------------- |
| `src/app/app.ts`                | Scene, orthographic camera, lighting, model loading  |
| `src/app/components/`           | Calibration card and settings dialog                 |
| `src/app/stores/`               | Screen setting store, persisted to `localStorage`    |
| `src/app/utils/`                | Calibration maths (card format, ppi derivation)      |
| `static/charachorder-models/`   | Device models (`.glb`)                               |

## Deployment

Pushing to `main` deploys to GitHub Pages through
[.github/workflows/main.yml](.github/workflows/main.yml) using `angular-cli-ghpages`. A GitLab CI
configuration for GitLab Pages is included as an alternative.

## License

This project's source code is licensed under the [MIT License](LICENSE).

However, the models located in the `static/charachorder-models` directory are licensed separately under the [CharaChorder BY-SA-CR](static/charachorder-models/LICENSE.md) License per the ShareAlike restriction of the [CharaChorder/CAD-CAM repository](https://github.com/CharaChorder/CAD-CAM/).
