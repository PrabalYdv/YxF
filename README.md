# Young & Freaks — website

Static site (HTML + CSS + JS only). No build step.

## Run locally
Open `index.html` in a browser, or serve the folder:
    python -m http.server 8000

## Publish on GitHub Pages
1. Create a repo and push this folder's contents to the `main` branch.
2. Repo → Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Site goes live at `https://<username>.github.io/<repo>/`.

## Editing
- **Runs (race bibs):** `index.html`, section `#runs`, one `<article class="bib">` per run. Copy one to add Run 004.
- **Reels carousel:** `index.html`, section `#reels`, one `<a class="reel">` per video (Instagram link + thumbnail in `assets/runs/`).
- **Photos:** drop images in `assets/runs/` and reference them in the `.film` strip.
- **Logo:** `assets/logo.jpg` (Instagram only serves 100×100 publicly — replace with a high-res/transparent PNG if you have one).
- **Colours / fonts:** top of `css/style.css` (`:root`).
- **3D hero track:** `js/track.js`. **Scroll animations:** `js/main.js`.
