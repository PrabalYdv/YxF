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
- **Runs (race bibs):** `index.html`, section `#runs`, one `<article class="bib">` per finished run. The dashed "next run" bib fills itself in from the registration sheet. When a run is done, copy a finished bib for it.
- **Reels carousel:** `index.html`, section `#reels`, one `<a class="reel">` per video (Instagram link + thumbnail in `assets/runs/`).
- **Photos:** drop images in `assets/runs/` and reference them in the `.film` strip.
- **Logo:** `assets/logo.jpg` (Instagram only serves 100×100 publicly — replace with a high-res/transparent PNG if you have one).
- **Colours / fonts:** top of `css/style.css` (`:root`).
- **3D hero track:** `js/track.js`. **Scroll animations:** `js/main.js`.

## Registrations (Google Sheet)

Registrations are saved to a Google Sheet. A small Apps Script in the sheet (`apps-script/Code.gs`) acts as the site's backend.

### One-time setup
1. Upload `apps-script/YxF-Registrations.xlsx` to Google Drive. Open it, then use **File → Save as Google Sheets**. The template already has `Admin`, `Run 1` … `Run 5` and all the columns. Run 5 starts open.
   (Or start from a blank Google Sheet. Step 3 creates the tabs.)
2. In the Google Sheet: **Extensions → Apps Script**. Delete what's there, paste in all of `apps-script/Code.gs`, and save.
3. Pick `setup` in the function dropdown and click **Run**. Accept the permissions prompt. This turns the TRUE/FALSE cells into checkboxes and adds the dropdowns. It never touches people's rows.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Click Deploy and copy the `/exec` URL.
5. Paste that URL into `js/config.js` as `API_URL`, then commit and push.

If you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version**. That keeps the same URL.

### Running it
- **Tabs:** `Admin` is reserved for later. `Run 1`, `Run 2`, … hold each run's sign-ups. The **highest-numbered `Run N` tab is the current run**, and the whole site shows that number.
- **Next run:** in the sheet menu, use **Young & Freaks → Add next run**. It creates `Run 6` with the right layout, and the site switches to Run 006. A new run starts **closed**.
- **Open / close (row 2 of the current run tab):**
  | Registration Open | Registration Closed | Open for Boys | Open for Girls |
  |---|---|---|---|
  | everyone can register | overrides everything — nobody can | only Male | only Female |
  With nothing ticked, registration is closed. Boys + Girls ticked lets in Male and Female but not Other.
- **Run Title / Run Date / Place** (E2, F2) show on the site's next-run bib and sign-up section.
- **IDs:** each ID is the sign-up time in IST as HHMM. For example, 22:03 gives `2203`. If someone else signs up in the same minute, they get `22031`, then `22032`, and so on.
- **Password:** date of birth as DDMMYYYY. For example, 1 Jan 2001 gives `01012001`.
- **Confirming people:** change the **Status** column from `Pending` to `Confirmed` or `Not Confirmed`. People see this when they use "Check status" on the site.
- The same phone number can't register twice for the same run.

### Columns (row 4 of each run tab)
| Column | Filled by | What it is |
|---|---|---|
| ID, Password, Name, DOB, Gender, Phone, Emergency Contact, College | website / you | the sign-up form |
| Registered At | website | sign-up time (IST) |
| Source | website / you | `Website` for sign-ups; write e.g. `Manual` or `Copied from Run 4` for rows you add |
| Status | you | `Pending` / `Confirmed` / `Not Confirmed`, shown on the site's status check |
| Attended | you | `Yes` / `No`: did they actually show up |
| Previous Runs | website | earlier runs the same phone number appears on, e.g. `3, 4` |
| Notes | you | anything |

The script finds columns **by header name**, so you can add your own columns (put them after `Notes`). Column order doesn't matter, as long as the header text matches.

### Old runs and carrying people over
- **Old runs:** type or paste each past run's people into `Run 1` … `Run 4` from row 5. Only the columns you have are needed; leave the rest blank. Put phone numbers in so **Previous Runs** works for new sign-ups. If you don't have an ID or password, leave them blank. Those people just can't use the site's status check for that run.
- **Next run:** after **Add next run**, copy rows from an older tab and paste them into the new tab from row 5. Website sign-ups are added underneath.
  - Pasted people **keep their old ID and password**, and can check their status for the new run.
  - Anyone pasted in can't register again on the site with the same phone number (they'll be told they're already on the list).
  - Clear or change the **Status** and **Attended** cells after pasting. Otherwise last run's "Confirmed" carries over.

> Don't commit a filled-in copy of the spreadsheet to this repo. The site is public. The `.xlsx` here is an empty template.

> The sheet holds phone numbers and birthdays. Share it **only with organisers** (as editors). The public site never reads the sheet directly; it only goes through the script.
