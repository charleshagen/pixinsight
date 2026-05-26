#engine v8

#feature-id    RealtimePreview : NightPhotons > RealtimePreview
#feature-info  An interactive image preview panel with view selection.

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#include <pjsr/controls/ImageView.js>

#define TITLE   "RealtimePreview"
#define VERSION "1.0.0"

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------



var RealtimePreviewDialog = class extends Dialog {
constructor() {
    super();

   this.windowTitle = TITLE + " " + VERSION;

   // -------------------------------------------------------------------------
   // Left side — ImageView (mirrors AnnotateImage's PreviewDialog)
   // -------------------------------------------------------------------------

   this.previewControl = new ImageView( this );

   this.onClose = function()
   {
      this.previewControl.reset();
      return true;
   };

   // -------------------------------------------------------------------------
   // Right side — view selector and controls
   // -------------------------------------------------------------------------

   this.viewSelector_Label = new Label( this );
   this.viewSelector_Label.text = "Source View:";
   this.viewSelector_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

   this.viewSelector_List = new ViewList( this );
   this.viewSelector_List.getAll();
   this.viewSelector_List.toolTip = "<p>Select an open view to display in the preview.</p>";
   this.viewSelector_List.onViewSelected = function( view )
   {
      this.dialog.updatePreview( view );
   };

   this.viewSelector_Sizer = new HorizontalSizer;
   this.viewSelector_Sizer.spacing = 6;
   this.viewSelector_Sizer.add( this.viewSelector_Label );
   this.viewSelector_Sizer.add( this.viewSelector_List, 100 );

   this.refresh_Button = new PushButton( this );
   this.refresh_Button.text = "Refresh";
   this.refresh_Button.icon = this.scaledResource( ":/icons/reload.png" );
   this.refresh_Button.toolTip = "<p>Re-render the selected view into the preview.</p>";
   this.refresh_Button.onClick = function()
   {
      let view = this.dialog.viewSelector_List.currentView;
      if ( view && !view.isNull )
         this.dialog.updatePreview( view );
   };

   this.close_Button = new PushButton( this );
   this.close_Button.defaultButton = true;
   this.close_Button.text = "Close";
   this.close_Button.icon = this.scaledResource( ":/icons/close.png" );
   this.close_Button.onClick = function()
   {
      this.dialog.ok();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.refresh_Button );
   this.buttons_Sizer.add( this.close_Button );

   this.controls_Sizer = new VerticalSizer;
   this.controls_Sizer.margin = 8;
   this.controls_Sizer.spacing = 8;
   this.controls_Sizer.add( this.viewSelector_Sizer );
   this.controls_Sizer.addStretch();
   this.controls_Sizer.add( this.buttons_Sizer );

   // -------------------------------------------------------------------------
   // Top-level layout — preview left, controls right
   // -------------------------------------------------------------------------

   this.sizer = new HorizontalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.previewControl, 100 );
   this.sizer.add( this.controls_Sizer );

   this.ensureLayoutUpdated();
   this.resize( this.logicalPixelsToPhysical( 1024 ), this.logicalPixelsToPhysical( 700 ) );

   // -------------------------------------------------------------------------
   // Methods
   // -------------------------------------------------------------------------

   this.updatePreview = function( view )
   {
      if ( !view || view.isNull || view.image.isEmpty )
         return;

      // Apply the view's current screen transfer function so the preview
      // matches what the user sees in the PixInsight workspace.
      let image = new Image( view.image );
      image.applyDisplayFunction( view.window.mainView.stf );
      let bitmap = image.render();
      image.free();

      this.previewControl.setImage( bitmap );
      bitmap.clear();

      this.previewControl.zoomToFit();
   };
}
};

RealtimePreviewDialog.prototype = new Dialog;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main()
{
   if ( Parameters.isViewTarget )
   {
      // When executed as a process instance on a view, auto-select that view.
      let dlg = new RealtimePreviewDialog();
      dlg.viewSelector_List.currentView = Parameters.targetView;
      dlg.updatePreview( Parameters.targetView );
      dlg.execute();
   }
   else
   {
      let dlg = new RealtimePreviewDialog();
      dlg.execute();
   }
}

main();
