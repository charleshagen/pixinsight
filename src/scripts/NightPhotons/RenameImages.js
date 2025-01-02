
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>

#feature-id    RenameImages : NightPhotons > RenameImages
#feature-icon  @script_icons_dir/RenameImages.svg
#feature-info  Automatically closes or renames images according to the output of a pattern and regular expression

#define TITLE "RenameImages"
#define VERSION "1.1.0"

var ToolParameters = {
   renameString: ".*filter_([a-zA-Z0-9]*).*integration|drizzle.*",
   renamePatternString: "{1}",
   renameEnabled: true,
   renameCaseInsensitive: true,
   closeString: ".*rejection|slope|weightimage.*",
   closeEnabled: true,
   closeCaseInsensitive: true,
   save: function () {
      Parameters.set("RenameString", ToolParameters.renameString); 
      Parameters.set("RenamePatternString", ToolParameters.renamePatternString); 
      Parameters.set("RenameEnabled", ToolParameters.renameEnabled); 
      Parameters.set("RenameCaseInsensitive", ToolParameters.renameCaseInsensitive); 
      Parameters.set("CloseString", ToolParameters.closeString); 
      Parameters.set("CloseEnabled", ToolParameters.closeEnabled); 
      Parameters.set("CloseCaseInsensitive", ToolParameters.closeCaseInsensitive); 
    },
   load: function () { 
      if (Parameters.has("RenameString")) {
         ToolParameters.renameString = Parameters.getString("RenameString");
      } 
      if (Parameters.has("RenamePatternString")) {
         ToolParameters.renamePatternString = Parameters.getString("RenamePatternString");
      } 
      if (Parameters.has("RenameEnabled")) {
         ToolParameters.renameEnabled = Parameters.getBoolean("RenameEnabled");
      } 
      if (Parameters.has("RenameCaseInsensitive")) {
         ToolParameters.renameCaseInsensitive = Parameters.getBoolean("RenameCaseInsensitive");
      } 
      if (Parameters.has("CloseString")) {
         ToolParameters.closeString = Parameters.getString("CloseString");
      } 
      if (Parameters.has("CloseEnabled")) {
         ToolParameters.closeEnabled = Parameters.getBoolean("CloseEnabled");
      }
      if (Parameters.has("CloseCaseInsensitive")) {
         ToolParameters.closeCaseInsensitive = Parameters.getBoolean("CloseCaseInsensitive");
      }
   }
};

function RenameImagesEngine() {
   this.execute = function () {
      let windows = ImageWindow.windows;

      const rename = new RegExp(ToolParameters.renameString, ToolParameters.renameCaseInsensitive ? "i" : "");
      const close = new RegExp(ToolParameters.closeString, ToolParameters.closeCaseInsensitive ? "i" : "");

      for (let i = 0; i < windows.length; i++) {
         let window = windows[i];
         let view = window.mainView;

         const closeMatch = view.id.match(close);
         if (ToolParameters.closeEnabled && closeMatch) {
            console.noteln("Closing view: \"" + view.id + "\"");
            view.window.close();
         }

         const renameMatch = view.id.match(rename);
         if (ToolParameters.renameEnabled && renameMatch) {
            if (renameMatch.length < 2) {
               console.warningln("Cannot rename image. Regular expression matched with no group on view: " + view.id);
               continue;
            }
            // const groupContent = renameMatch.slice(1).join("_");

            let content = ToolParameters.renamePatternString.replace(/\{(\d+)(\-[a-zA-Z])?\}/g, (_, i, f) => {
               const index = parseInt(i);
               const value = index >= 0 && index < renameMatch.length ? renameMatch[index].toString() : ''; 
               if (value.length == 0) {
                  console.warningln("No value for index " + index);
                  return "";
               }
               switch(f) {
                  case "-u":
                     return value.toUpperCase();
                  case "-l":
                     return value.toLowerCase();
                  case "-p":
                     return value[0].toUpperCase() + (value.length > 1 ? value.slice(1).toLowerCase() : "");
                  default:
                     return value;
               }
            });

            content = content.replace(/\$([a-zA-Z]+)(\-[a-zA-Z])?\$/g, (_, n, f) => {
               const name = n.toUpperCase();
               const keywords = window.keywords;
               for (let j = 0; j < keywords.length; j++) {
                  const fits = keywords[j];
                  if (fits.name.toUpperCase() == name) {
                     const value = fits.strippedValue;
                     // console.criticalln("DEBUG FITS value: \"" + value + "\"");
                     if (value.length == 0) {
                        console.warningln("No value for index " + index);
                        return "";
                     }
                     switch(f) {
                        case "-u":
                           return value.toUpperCase();
                        case "-l":
                           return value.toLowerCase();
                        case "-p":
                           return value[0].toUpperCase() + (value.length > 1 ? value.slice(1).toLowerCase() : "");
                        default:
                           return value;
                     }
                  }
               }
               console.warningln("Failed to find FITS Keyword \"" + name + "\"");
               return "";
            });
            
            let id = this.generateValidID(content);
            console.noteln("Renaming view \"" + view.id + "\" to \"" + id + "\"");
            view.id = id;
            // Deiconize the image and reiconize it to present the changed identifier if iconic
            if (window.iconic) {
               window.deiconize();
               window.iconize();
            }
         } 
      }
   };

   this.generateValidID = function (id) {
      id = id.replace(/[^\w]+/g,"_");
      if (id[0] >= '0' && id[0] <= '9') {
         id = "_" + id;
      }
      let iteration = 1;
      let newID = id + iteration;
      if (View.viewById(id).isNull) {
         return id;
      }
      while (!View.viewById(newID).isNull) {
         iteration += 1;
         newID = id + iteration;
      }
      return newID;
   }
}

var engine = new RenameImagesEngine;

function MainDialog() {
   this.__base__ = Dialog;
   this.__base__();
   var self = this;

   var labelWidth = this.font.width("Pattern: ");

   // MAIN DIALOG BODY

   // Window parameters
   this.windowTitle = TITLE;
   var panelWidth = this.font.width("<b>" + TITLE + "v" + VERSION + "</b> | Charles Hagen");
   this.minWidth = panelWidth;
   this.width = 400;

   // --------------------------------------------------------------
   // Description & Title
   // --------------------------------------------------------------
   this.label = new Label(this);
   with (this.label) {
      wordWrapping = true;
      useRichText = true;
      margin = 4;
      text = "<b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen"
         + "<p>Execute this script after opening files to rename or close all open views with identifiers matching the provided regular expressions. "
         + "Be careful to test the Regex first, as all image closures are final and irreversable. Default expressions should work in most cases for WBPP / FBPP "
         + "to close autogenerated maps and rename master lights to their filter name.</p>"
         + "<p><i>Create a process icon and apply directly to any image to run without opening the dialog.</i></p>";
   }

   // --------------------------------------------------------------
   // Rename Group
   // --------------------------------------------------------------

   // Regex
   this.renameRegex_Label = new Label(this);
   with (this.renameRegex_Label) {
      text = "Regex: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.renameRegex_Edit = new Edit(this);
   with (this.renameRegex_Edit) {
      margin = 4;
      text = ToolParameters.renameString;
      onTextUpdated = function () {
         ToolParameters.renameString = text;
      }
   }

   this.renameRegex_Sizer = new HorizontalSizer;
   with (this.renameRegex_Sizer) {
      margin = 6;
      add(this.renameRegex_Label);
      add(this.renameRegex_Edit);
   }

   // Pattern
   this.renamePattern_Label = new Label(this);
   with (this.renamePattern_Label) {
      text = "Pattern: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.renamePattern_Edit = new Edit(this);
   with (this.renamePattern_Edit) {
      margin = 4;
      text = ToolParameters.renamePatternString;
      onTextUpdated = function () {
         ToolParameters.renamePatternString = text;
      }
   }

   this.renamePattern_Sizer = new HorizontalSizer;
   with (this.renamePattern_Sizer) {
      margin = 6;
      add(this.renamePattern_Label);
      add(this.renamePattern_Edit);
   }

   // Flags
   this.renameFlags_Label = new Label(this);
   with (this.renameFlags_Label) {
      text = "Flags: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   // Case Insensitive
   this.renameCaseInsensitive_CheckBox = new CheckBox(this);
   with (this.renameCaseInsensitive_CheckBox) {
       toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
       checked = ToolParameters.renameCaseInsensitive;
       text = "Case Insensitive";
       onCheck = function () {
           ToolParameters.renameCaseInsensitive = checked;
       }
   }

   // Flags sizer
   this.renameFlags_Sizer = new HorizontalSizer;
   with (this.renameFlags_Sizer) {
      margin = 6;
      add(this.renameFlags_Label);
      add(this.renameCaseInsensitive_CheckBox);
      addStretch();
   }

   // Group
   this.renameGroup = new GroupBox(this)
   with (this.renameGroup) {
       title = "Rename Images";
       sizer = new VerticalSizer;
       toolTip = "<p> Rename all open views with identifiers matching the provided regex. By default, it will rename standard WBPP and FBPP output to the filter name. All captured groups are joined with underscores to form the new identifier. </p>";
       titleCheckBox = true;
       checked = ToolParameters.renameEnabled;
       onCheck = function () {
           ToolParameters.renameEnabled = checked;
       }
   }
   with (this.renameGroup.sizer) {
      margin = 2;
      add(this.renameRegex_Sizer);
      add(this.renamePattern_Sizer);
      add(this.renameFlags_Sizer);
   }

   // --------------------------------------------------------------
   // Close Images Group
   // --------------------------------------------------------------

   // Regex
   this.closeRegex_Label = new Label(this);
   with (this.closeRegex_Label) {
      text = "Regex: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.closeRegex_Edit = new Edit(this);
   with (this.closeRegex_Edit) {
      margin = 4;
      text = ToolParameters.closeString;
      onTextUpdated = function () {
         ToolParameters.closeString = text;
      }
   }

   this.closeRegex_Sizer = new HorizontalSizer;
   with (this.closeRegex_Sizer) {
      margin = 6;
      add(this.closeRegex_Label);
      add(this.closeRegex_Edit);
   }

   // Flags
   this.closeFlags_Label = new Label(this);
   with (this.closeFlags_Label) {
      text = "Flags: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   // Case Insensitive
   this.closeCaseInsensitive_CheckBox = new CheckBox(this);
   with (this.closeCaseInsensitive_CheckBox) {
       toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
       checked = ToolParameters.closeCaseInsensitive;
       text = "Case Insensitive";
       onCheck = function () {
           ToolParameters.closeCaseInsensitive = checked;
       }
   }

   // Flags sizer
   this.closeFlags_Sizer = new HorizontalSizer;
   with (this.closeFlags_Sizer) {
      margin = 6;
      add(this.closeFlags_Label);
      add(this.closeCaseInsensitive_CheckBox);
      addStretch();
   }


   // Group
   this.closeGroup = new GroupBox(this)
   with (this.closeGroup) {
       title = "Close Images";
       sizer = new VerticalSizer;
       toolTip = "<p> Use the defined regex to close matching images. By default, images with identifiers containing \"rejection\", \"slope\", \"weightImage\" will be closed. This will close maps autogenerated by WBPP and FBPP.</p>"
       titleCheckBox = true;
       checked = ToolParameters.closeEnabled;
       onCheck = function () {
           ToolParameters.closeEnabled = checked;
       }
   }
   with (this.closeGroup.sizer) {
      margin = 2;
      add(this.closeRegex_Sizer);
      add(this.closeFlags_Sizer);
   }

   // --------------------------------------------------------------
   // Bottom Button Row
   // --------------------------------------------------------------

   this.newInstanceButton = new ToolButton(this);
   with (this.newInstanceButton) {
      icon = this.scaledResource(":/process-interface/new-instance.png");
      setScaledFixedSize(20, 20);
      toolTip = "New Instance";
      onMousePress = function () {
         this.hasFocus = true;
         ToolParameters.save();

         this.pushed = false;
         this.dialog.newInstance();
      };
   }

   this.ok_Button = new PushButton(this);
   with (this.ok_Button) {
      text = "Execute";
      icon = this.scaledResource(":/icons/ok.png");
      onClick = function () {
         this.dialog.ok();
      };
   }

   this.cancel_Button = new PushButton(this);
   with (this.cancel_Button) {
      text = "Cancel";
      icon = this.scaledResource(":/icons/cancel.png");
      onClick = function () {
         this.dialog.cancel();
      };
   }

   this.buttons_Sizer = new HorizontalSizer;
   with (this.buttons_Sizer) {
      scaledSpacing = 6;
      add(this.newInstanceButton);
      addStretch();
      add(this.ok_Button);
      add(this.cancel_Button);
   }


   // GLOBAL SIZER
   this.sizer = new VerticalSizer(this);
   with (this.sizer) {
      margin = 6;
      spacing = 4;
      add(this.label);
      addSpacing(4);
      add(this.renameGroup)
      addSpacing(4);
      add(this.closeGroup)
      addStretch();
      add(this.buttons_Sizer);
   }
}
MainDialog.prototype = new Dialog;

function showDialog() {
   let dialog = new MainDialog;
   return dialog.execute();
}

function main() {
   let retVal = 0;
   if (Parameters.isViewTarget) {
      ToolParameters.load();
      ToolParameters.targetView = Parameters.targetView; //Parameters.targetView is the image being applied to
      retVal = 1; // Dialog is never shown
   } else if (Parameters.isGlobalTarget) {
      ToolParameters.load();// Load the parameters in global context
      retVal = showDialog();
   } else {
      retVal = showDialog();
   }

   if (retVal == 1) {
      engine.execute();
   }
}

main();
