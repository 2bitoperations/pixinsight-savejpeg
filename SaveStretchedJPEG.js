#engine v8

#feature-id    SaveStretchedJPEG : Utilities > SaveStretchedJPEG
#feature-info  Saves the active image as a stretched 8-bit export (JPEG, PNG, or TIFF) \
               using its current screen transfer function (STF).

#define TITLE "Save Stretched Image"

// Top-level declarations use `var` (and a class *expression*) so the script can be
// re-run in a persistent V8 runtime without "already declared" errors.

// ─── Formats ──────────────────────────────────────────────────────────────────
// name:    PixInsight file format id
// exts:    accepted extensions; the first one is the default
// options: dialog property holding this format's option group (or null)
// hints:   builds the format-specific output hints from the dialog
var TIFF_COMPRESSION = [
   { label: "None",          hint: "no-compression"  },
   { label: "LZW",           hint: "lzw-compression" },
   { label: "ZIP (Deflate)", hint: "zip-compression" }
];

var FORMATS = [
   { label: "JPEG", name: "JPEG", exts: [".jpeg", ".jpg"], options: "jpegOptions",
     hints: function( d )
     {
        return "quality " + Math.round( d.jpegQuality.value ) +
               (d.jpegProgressive.checked ? " progressive" : "");
     } },
   // PixInsight's PNG module is Qt-based and accepts no output hints.
   { label: "PNG",  name: "PNG",  exts: [".png"], options: null,
     hints: function( d ) { return ""; } },
   { label: "TIFF", name: "TIFF", exts: [".tiff", ".tif"], options: "tiffOptions",
     hints: function( d ) { return TIFF_COMPRESSION[d.tiffCompression.currentItem].hint; } }
];

function fileFilters( format )
{
   return [ [ format.label + " Files" ].concat( format.exts.map( e => "*" + e ) ) ];
}

function hasFormatExtension( path, format )
{
   return format.exts.indexOf( File.extractExtension( path ).toLowerCase() ) >= 0;
}

function samePath( a, b )
{
   // macOS and Windows file systems are usually case-insensitive.
   return a.toLowerCase() === b.toLowerCase();
}

// ─── STF → HistogramTransformation ───────────────────────────────────────────
// view.stf rows are [m, c0, c1, r0, r1]; HistogramTransformation rows are
// [c0, m, c1, r0, r1]. HT rows 0–2 apply to R, G, B; row 3 is the combined
// channel, which is the one that applies to grayscale images.

var IDENTITY = [ 0, 0.5, 1, 0, 1 ];

function stfRowToHT( s )
{
   return [ s[1], s[0], s[2], s[3], s[4] ];
}

function isIdentitySTF( s )
{
   return s[0] == 0.5 && s[1] == 0 && s[2] == 1;
}

function stfIsActive( stf, isColor )
{
   return isColor ? !(isIdentitySTF( stf[0] ) && isIdentitySTF( stf[1] ) && isIdentitySTF( stf[2] ))
                  : !isIdentitySTF( stf[0] );
}

function htRowsFromSTF( stf, isColor )
{
   return isColor ?
      [ stfRowToHT( stf[0] ), stfRowToHT( stf[1] ), stfRowToHT( stf[2] ), IDENTITY, IDENTITY ] :
      [ IDENTITY, IDENTITY, IDENTITY, stfRowToHT( stf[0] ), IDENTITY ];
}

// ─── Options dialog ───────────────────────────────────────────────────────────

var SaveImageDialog = class extends Dialog
{
   constructor( sourceWindow, suggestedPath )
   {
      super();
      let self = this;

      this.sourcePath = sourceWindow.filePath;
      this.defaultName = sourceWindow.mainView.id;
      this.targetPath = "";        // set by validate() when OK is accepted
      this.confirmedPath = "";     // a path the user already agreed to overwrite in a file dialog

      this.windowTitle = TITLE;

      // ── Warning ────────────────────────────────────────────────────────────
      this.warningLabel = new Label( this );
      this.warningLabel.useRichText  = true;
      this.warningLabel.wordWrapping = true;
      this.warningLabel.minWidth     = 420;
      this.warningLabel.text =
         "<b>Heads up:</b> these exports bake in your current STF stretch and " +
         "reduce the image to 8-bit — what you see is what you get. They are " +
         "great for posting to social media or sending to grandma, but are " +
         "completely unsuitable for archiving, stacking, or sharing with " +
         "anyone who'll want to do further processing.";

      // ── Output path ────────────────────────────────────────────────────────
      let pathLabel = new Label( this );
      pathLabel.text = "Output path:";

      this.pathEdit = new Edit( this );
      this.pathEdit.minWidth = 360;
      this.pathEdit.text     = suggestedPath;
      this.pathEdit.toolTip  = "<p>Full path for the output file.</p>" +
                               "<p>Edit directly, or use Browse to pick a location.</p>";

      this.browseButton = new ToolButton( this );
      this.browseButton.icon = this.scaledResource( ":/browser/select-file.png" );
      this.browseButton.setScaledFixedSize( 20, 20 );
      this.browseButton.toolTip = "Browse for output location…";
      this.browseButton.onClick = function()
      {
         self.browse();
      };

      let pathSizer = new HorizontalSizer;
      pathSizer.spacing = 4;
      pathSizer.add( pathLabel );
      pathSizer.add( this.pathEdit, 100 );
      pathSizer.add( this.browseButton );

      this.unsavedHint = new Label( this );
      this.unsavedHint.text    = "This image has no source file — use Browse to choose an output location.";
      this.unsavedHint.visible = suggestedPath === "";

      // ── Format selector ────────────────────────────────────────────────────
      let formatLabel = new Label( this );
      formatLabel.text = "Format:";

      this.formatCombo = new ComboBox( this );
      for ( let i = 0; i < FORMATS.length; ++i )
         this.formatCombo.addItem( FORMATS[i].label );
      this.formatCombo.currentItem = 0;
      this.formatCombo.onItemSelected = function( index )
      {
         let path = self.pathEdit.text.trim();
         if ( path !== "" && !hasFormatExtension( path, FORMATS[index] ) )
            self.pathEdit.text = File.changeExtension( path, FORMATS[index].exts[0] );
         self.updateOptionsVisibility();
      };

      let formatSizer = new HorizontalSizer;
      formatSizer.spacing = 4;
      formatSizer.add( formatLabel );
      formatSizer.add( this.formatCombo );
      formatSizer.addStretch();

      // ── JPEG options ───────────────────────────────────────────────────────
      this.jpegOptions = new GroupBox( this );
      this.jpegOptions.title = "JPEG Options";

      this.jpegQuality = new NumericControl( this.jpegOptions );
      this.jpegQuality.label.text     = "Quality:";
      this.jpegQuality.label.minWidth = 80;
      this.jpegQuality.setRange( 1, 100 );
      this.jpegQuality.slider.setRange( 1, 100 );
      this.jpegQuality.slider.minWidth = 220;
      this.jpegQuality.setPrecision( 0 );
      this.jpegQuality.setValue( 95 );
      this.jpegQuality.toolTip = "JPEG quality: 1 (worst / smallest) to 100 (best / largest).";

      this.jpegProgressive = new CheckBox( this.jpegOptions );
      this.jpegProgressive.text    = "Progressive scan";
      this.jpegProgressive.checked = false;
      this.jpegProgressive.toolTip = "Write a progressive-scan JPEG (renders in multiple passes; common for web).";

      this.jpegOptions.sizer = new VerticalSizer;
      this.jpegOptions.sizer.margin  = 6;
      this.jpegOptions.sizer.spacing = 4;
      this.jpegOptions.sizer.add( this.jpegQuality );
      this.jpegOptions.sizer.add( this.jpegProgressive );

      // ── TIFF options ───────────────────────────────────────────────────────
      this.tiffOptions = new GroupBox( this );
      this.tiffOptions.title = "TIFF Options";

      let tiffCompLabel = new Label( this.tiffOptions );
      tiffCompLabel.text = "Compression:";

      this.tiffCompression = new ComboBox( this.tiffOptions );
      for ( let i = 0; i < TIFF_COMPRESSION.length; ++i )
         this.tiffCompression.addItem( TIFF_COMPRESSION[i].label );
      this.tiffCompression.currentItem = 1; // LZW
      this.tiffCompression.toolTip = "TIFF compression algorithm — all options are lossless.";

      let tiffCompSizer = new HorizontalSizer;
      tiffCompSizer.spacing = 4;
      tiffCompSizer.add( tiffCompLabel );
      tiffCompSizer.add( this.tiffCompression );
      tiffCompSizer.addStretch();

      this.tiffOptions.sizer = new VerticalSizer;
      this.tiffOptions.sizer.margin  = 6;
      this.tiffOptions.sizer.spacing = 4;
      this.tiffOptions.sizer.add( tiffCompSizer );

      // ── OK / Cancel ────────────────────────────────────────────────────────
      this.okButton = new PushButton( this );
      this.okButton.defaultButton = true;
      this.okButton.text = "OK";
      this.okButton.icon = this.scaledResource( ":/icons/ok.png" );
      this.okButton.onClick = function()
      {
         if ( self.validate() )
            self.ok();
      };

      this.cancelButton = new PushButton( this );
      this.cancelButton.text = "Cancel";
      this.cancelButton.icon = this.scaledResource( ":/icons/cancel.png" );
      this.cancelButton.onClick = function()
      {
         self.cancel();
      };

      let buttonSizer = new HorizontalSizer;
      buttonSizer.spacing = 6;
      buttonSizer.addStretch();
      buttonSizer.add( this.okButton );
      buttonSizer.add( this.cancelButton );

      // ── Root layout ────────────────────────────────────────────────────────
      this.sizer = new VerticalSizer;
      this.sizer.margin  = 8;
      this.sizer.spacing = 8;
      this.sizer.add( this.warningLabel );
      this.sizer.addSpacing( 4 );
      this.sizer.add( pathSizer );
      this.sizer.add( this.unsavedHint );
      this.sizer.add( formatSizer );
      this.sizer.add( this.jpegOptions );
      this.sizer.add( this.tiffOptions );
      this.sizer.addSpacing( 4 );
      this.sizer.add( buttonSizer );

      this.updateOptionsVisibility();
   }

   get format()
   {
      return FORMATS[this.formatCombo.currentItem];
   }

   updateOptionsVisibility()
   {
      let current = this.format.options;
      for ( let i = 0; i < FORMATS.length; ++i )
         if ( FORMATS[i].options !== null )
            this[FORMATS[i].options].visible = FORMATS[i].options === current;
      this.adjustToContents();
   }

   // Native save dialog; it asks about overwriting on its own.
   browse()
   {
      let d = new SaveFileDialog;
      d.caption     = TITLE;
      d.filters     = fileFilters( this.format );
      d.initialPath = this.pathEdit.text.trim() || (this.defaultName + this.format.exts[0]);
      if ( !d.execute() )
         return false;
      this.pathEdit.text = d.filePath;
      this.confirmedPath = d.filePath;
      this.unsavedHint.visible = false;
      return true;
   }

   error( message )
   {
      (new MessageBox( message, TITLE, StdIcon.Error, StdButton.Ok )).execute();
      return false;
   }

   // Resolves and checks the output path; sets this.targetPath on success.
   validate()
   {
      let path = this.pathEdit.text.trim();
      if ( path === "" )
      {
         if ( !this.browse() )
            return false;
         path = this.pathEdit.text;
      }

      if ( !hasFormatExtension( path, this.format ) )
      {
         path = File.changeExtension( path, this.format.exts[0] );
         this.pathEdit.text = path;
      }

      let dir = File.extractDrive( path ) + File.extractDirectory( path );
      if ( dir === "" )
         return this.error( "<p>Please enter a full path, including the folder.</p>" );
      if ( !File.directoryExists( dir ) )
         return this.error( "<p>The folder does not exist:</p><p>" + dir + "</p>" );
      if ( this.sourcePath !== "" && samePath( path, this.sourcePath ) )
         return this.error( "<p>That is the image's own source file. Choose a different name " +
                            "so the original isn't overwritten.</p>" );

      if ( File.exists( path ) && !samePath( path, this.confirmedPath ) )
         if ( (new MessageBox( "<p>The file already exists:</p><p>" + path + "</p><p>Overwrite it?</p>",
                               TITLE, StdIcon.Warning, StdButton.Yes, StdButton.No )).execute() != StdButton.Yes )
            return false;

      this.targetPath = path;
      return true;
   }
};

// ─── Export ───────────────────────────────────────────────────────────────────
// Returns "" on success, or an error message.

function exportStretched( view, stf, format, path, hints )
{
   let image = view.image;
   let tmp = new ImageWindow( image.width, image.height, image.numberOfChannels,
                              view.window.bitsPerSample, view.window.isFloatSample,
                              image.isColor, "SaveStretchedJPEG_tmp" );
   try
   {
      let tmpView = tmp.mainView;
      tmpView.beginProcess( UndoFlag.NoSwapFile );
      tmpView.image.assign( image );
      tmpView.endProcess();

      let rows = htRowsFromSTF( stf, image.isColor );
      console.writeln( "<end><cbr>Applying STF as HistogramTransformation (" +
                       (image.isColor ? "RGB" : "grayscale") + "), rows [c0, m, c1, r0, r1]:" );
      for ( let i = 0; i < 4; ++i )
         console.writeln( "  " + ["R/K", "G", "B", "RGB/K"][i] + ": [" +
                          rows[i].map( x => Number( x ).toFixed( 6 ) ).join( ", " ) + "]" );
      let ht = new HistogramTransformation;
      ht.H = rows;
      ht.executeOn( tmpView, false/*swapFile*/ );

      // Quantize to 8 bits after stretching, so every format really is 8-bit.
      let sfc = new SampleFormatConversion;
      sfc.format = SampleFormatConversion.To8Bit;   // V8: process enums are static, not on .prototype
      sfc.executeOn( tmpView, false/*swapFile*/ );

      let fmt = new FileFormat( format.name, false/*toRead*/, true/*toWrite*/ );
      if ( fmt.isNull )
         return format.label + " format is not available.";

      let f = new FileFormatInstance( fmt );
      if ( f.isNull )
         return "Could not create a " + format.label + " format instance.";

      if ( !f.create( path, hints ) )
         return "Could not create the output file.";

      let ok = f.writeImage( tmpView.image );
      f.close();
      if ( !ok )
      {
         if ( File.exists( path ) )
            File.remove( path );
         return "Failed to write the " + format.label + " file.";
      }
      return "";
   }
   finally
   {
      tmp.forceClose();
   }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main()
{
   let window = ImageWindow.activeWindow;
   if ( window.isNull )
   {
      (new MessageBox( "<p>Open an image first.</p>", TITLE, StdIcon.Error, StdButton.Ok )).execute();
      return;
   }

   let view = window.mainView;
   let stf  = view.stf;

   if ( !stfIsActive( stf, view.image.isColor ) )
      if ( (new MessageBox( "<p>This image has no STF stretch applied, so the export will look " +
                            "exactly like the linear image (usually almost black).</p>" +
                            "<p>Apply an STF first (e.g. AutoStretch), or continue anyway?</p>",
                            TITLE, StdIcon.Warning, StdButton.Yes, StdButton.No )).execute() != StdButton.Yes )
         return;

   // Pre-fill the path with a JPEG next to the source file, never the source file itself.
   let suggestedPath = "";
   let sourcePath = window.filePath;
   if ( sourcePath !== "" )
   {
      suggestedPath = File.changeExtension( sourcePath, FORMATS[0].exts[0] );
      if ( samePath( suggestedPath, sourcePath ) )
         suggestedPath = File.appendToName( suggestedPath, "_stretched" );
   }

   let dialog = new SaveImageDialog( window, suggestedPath );
   if ( !dialog.execute() )
      return;

   let format = dialog.format;
   let hints  = format.hints( dialog );
   let error  = exportStretched( view, stf, format, dialog.targetPath, hints );

   if ( error === "" )
   {
      console.writeln( "<end><cbr><b>Saved stretched " + format.label + " to:</b> " + dialog.targetPath );
      if ( hints !== "" )
         console.writeln( "  hints: " + hints );
   }
   else
   {
      console.criticalln( error );
      (new MessageBox( "<p>" + error + "</p>", TITLE, StdIcon.Error, StdButton.Ok )).execute();
   }
}

main();
