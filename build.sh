#!/usr/bin/env bash
# Builds the PixInsight update repository in ./repository:
#   repository/updates.xri                    – repository index read by PixInsight
#   repository/SaveStretchedJPEG-<date>.zip   – package; paths are relative to the PixInsight install root
#
# PixInsight repository URL (add in Resources > Updates > Manage Repositories):
#   https://raw.githubusercontent.com/2bitoperations/pixinsight-savejpeg/pixinsight-repo/
set -euo pipefail
cd "$(dirname "$0")"

NAME=SaveStretchedJPEG
SCRIPT=$NAME.js
OUT=repository
# Compatible PixInsight versions. Keep the upper bound open; a closed bound makes
# newer PixInsight releases silently ignore the repository.
PI_VERSIONS="1.9.4:9.9.9"   # needs the V8 script engine (#engine v8)

# Release date = date of the last commit that touched the script, so rebuilding
# without changes produces an identical package (same filename and sha1).
RELEASE_DATE=$(git log -1 --format=%cd --date=format:%Y%m%d -- "$SCRIPT" 2>/dev/null || true)
[ -n "$RELEASE_DATE" ] || RELEASE_DATE=$(date +%Y%m%d)
if ! git diff --quiet HEAD -- "$SCRIPT" 2>/dev/null; then
    echo "warning: $SCRIPT has uncommitted changes; using today's date" >&2
    RELEASE_DATE=$(date +%Y%m%d)
fi

ZIP=$NAME-$RELEASE_DATE.zip

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/src/scripts/$NAME"
cp "$SCRIPT" "$STAGE/src/scripts/$NAME/"
# Fixed mtimes so the zip is byte-for-byte reproducible.
find "$STAGE/src" -exec touch -t "${RELEASE_DATE}0000" {} +

rm -rf "$OUT"
mkdir -p "$OUT"
(cd "$STAGE" && zip -qrX "$OLDPWD/$OUT/$ZIP" src)
SHA1=$(shasum -a 1 "$OUT/$ZIP" | cut -d' ' -f1)

cat > "$OUT/updates.xri" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
   <description>
      <p>$NAME: save the active image as a stretched JPEG/PNG/TIFF using the current STF.</p>
   </description>
   <platform os="all" arch="noarch" version="$PI_VERSIONS">
      <package fileName="$ZIP" sha1="$SHA1" type="script" releaseDate="$RELEASE_DATE">
         <title>$NAME</title>
         <description>
            <p>Adds Script &gt; Utilities &gt; $NAME. Exports the active image with its current STF stretch baked in, as 8-bit JPEG, PNG, or TIFF.</p>
         </description>
      </package>
   </platform>
</xri>
EOF

echo "Built $OUT/$ZIP (sha1 $SHA1)"
