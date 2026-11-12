# pixinsight-savejpeg

A PixInsight script (**Script > Utilities > SaveStretchedJPEG**) that saves the active image as a
JPEG, PNG, or TIFF with its current STF stretch baked in. The output is 8-bit and meant for sharing,
not for archiving or further processing.

Requires PixInsight 1.9.4 or later (the script runs on the V8 JavaScript engine).

## Install via PixInsight's update system

1. **Edit > Preferences > Security**: enable **Allow unsigned repositories**. This repository isn't
   signed with a Pleiades-certified developer key, and PixInsight rejects unsigned repositories by
   default.
2. **Resources > Updates > Manage Repositories > Add**, and enter:

   ```
   https://raw.githubusercontent.com/2bitoperations/pixinsight-savejpeg/pixinsight-repo/
   ```

   (Keep the trailing slash.)
3. **Resources > Updates > Check for Updates**, apply the update, and restart PixInsight.
4. If the menu item doesn't appear, run **Script > Feature Scripts… > Regenerate**.

Running the script may show an "unsigned script" warning, depending on your Security preferences.

## Manual install

**Script > Feature Scripts… > Add**, then pick the folder that holds `SaveStretchedJPEG.js`.

## Releasing a new version

Merge to `main`. When a push changes `SaveStretchedJPEG.js` (or `build.sh` or the workflow), the
**Publish PixInsight repository** GitHub Action runs `build.sh` and force-pushes the result
(`updates.xri` plus the zip) to the `pixinsight-repo` branch, which PixInsight reads. You can also
start it by hand from the Actions tab.

The package is dated by the last commit that touched the script, and PixInsight offers an update only
when that date (`YYYYMMDD`) is newer than the installed one. **Two releases on the same day share a
date, so users who already took the first won't be offered the second.**

To build locally (output goes to the gitignored `repository/`): `./build.sh`.
