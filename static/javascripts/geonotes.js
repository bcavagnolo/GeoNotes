var map;
var notes; // layer for geonote markers

// These are some one-time initializations for the GeoNotes
var size = new OpenLayers.Size(21,25);
var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);
var formatter = new OpenLayers.Format.GeoJSON();
var selectControl;

// Calculate the URL of web service
var l = window.location;
var baseURL = l.protocol + "//" + l.host + "/" + l.pathname.split('/')[1] + "geonotes";

// This is the template for the geonote creation form.  I really want to put
// this in the html and not here.  But it's not immediately obvious to me how
// to do that.
gnote_new_template = "<div id=\"uc_geonote\">" +
  "<form id=\"uc_geonote_form\">" +
  "<div><span id=\"uc_geonote_status\"/>&nbsp;</div>" +
  "<div>" +
  "<textarea id=\"geonote_new\" name=\"geonote_new\" rows=\"4\" cols=\"25\">Enter new GeoNote</textarea>" +
  "</div>" +
  "<a id=\"geonote_submit\" href=\"#\" class=\"ucgn\">Submit</a>" +
  "<a id=\"geonote_update\" href=\"#\" class=\"ucgn\" style=\"display: none\">Update</a>" +
  "<a id=\"geonote_delete\" href=\"#\" class=\"ucgn\" style=\"display: none\">Delete</a>" +
  "</form>" +
  "</div>"

// A GeoNote is just a decorated vector feature
GeoNote = OpenLayers.Class(OpenLayers.Feature.Vector, {

  initialize: function(lonlat, note, uri) {
    this.lat = lonlat.lat;
    this.lon = lonlat.lon;
    this.uri = uri;
    this.template = gnote_new_template;
    if (note != undefined)
      this.note = note;
    OpenLayers.Feature.Vector.prototype.initialize.apply(
      this,
      [new OpenLayers.Geometry.Point(this.lon, this.lat), null, null]
    );
  },

  clickHandler: function (e) {
    this.popup = new OpenLayers.Popup.FramedCloud(
      this.id, 
      this.geometry.getBounds().getCenterLonLat(),
      null,
      gnote_new_template,
      null, true, this.onPopupClose);
    map.addPopup(this.popup);
    this.popup.data = this;
    gnote = this;
    $("a").filter(".ucgn").each(function(index) {
      $(this).click(function() {
        uc({"event":$(this).attr('id')}, gnote);
      });
    });
    if (this.note != undefined) {
      $("textarea.#geonote_new").text(this.note);
      $('#geonote_submit').hide();
      $('#geonote_update').show();
      $('#geonote_delete').show();
    }
  },

  onPopupClose: function (e) {
    uc({"event":"geonote_cancel"}, this.data);
  },

  unClickHandler: function (e) {
    if (this.popup == null)
      return;
    map.removePopup(this.popup);
    this.popup.destroy();
    this.popup = null;
  },
});

OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {
  defaultHandlerOptions: {
    'single': true,
    'double': false,
    'pixelTolerance': 0,
    'stopSingle': false,
    'stopDouble': false
  },

  initialize: function(options) {
    this.handlerOptions = OpenLayers.Util.extend(
      {}, this.defaultHandlerOptions
    );
    OpenLayers.Control.prototype.initialize.apply(
      this, arguments
    ); 
    this.handler = new OpenLayers.Handler.Click(
      this, {
        'click': function (e) {
          var lonlat = map.getLonLatFromViewPortPx(e.xy);
          uc({"event":"geonote_new", "lonlat":lonlat});
        }
      }, this.handlerOptions
    );
  },
});

// This is the user controller state machine.  It should all be wrapped up in a
// class.  Oh well.
UCStates = {
  LOGGED_OUT:0,
  LOGGING_IN:1,
  LOGGED_IN:2,
  AUTHENTICATING:3,
  REGISTRATION_INPUT:4,
  REGISTERING:5,
  CREATING_GNOTE:6,
  STORING_GNOTE:7,
  CREATING_LAYER:8,
  LOADING_LAYER:9,
  LOADING_GEONOTES:10,
  CANCELLING_GEONOTE:11,
  DELETING_GEONOTE:12,
}

UCState = UCStates.LOGGED_OUT;
var req = null;
var username = null;
var password = null;
var auth = null;
var numGeoNotes;
var gnReqs = [];

var auth_msg = {
  FORBIDDEN:"Error: incorrect credentials",
  "":"Error: Failed to contact server",
};

var reg_msg = {
  "BAD REQUEST":"That username appears to be unavailable.",
  "FORBIDDEN":"Failed to create default layer.  Try again.",
  "":"Error: Failed to contact server",
};

function uc_set_logged_in() {
  $('#uc_login').hide();
  $('#uc_logged_in').show();
  $('#uc_logged_out').hide();
  $("#uc_login_status").text("");
  $('#uc_registration').hide();
  $("#uc_reg_status").text("");
  if (req) req.abort();
}

function uc_set_logged_out() {
  $('#uc_login').hide();
  $('#uc_logged_in').hide();
  $('#uc_logged_out').show();
  $("#uc_login_status").text("")
  $("#uc_reg_status").text("");
  $('#uc_registration').hide();
  if (req) req.abort();
  notes.removeAllFeatures();
}

function uc(e, gnote) {
  console.log("User Controller State: " + UCState)
  console.log("User Controller Event: " + JSON.stringify(e));

  switch (UCState) {
  case UCStates.LOGGED_OUT:
    if (e["event"] == "init") {
      console.log("user controller initialized");
    } else if (e["event"] == "login") {
      $('#uc_login').show();
      $('#username').focus();
      UCState = UCStates.LOGGING_IN;
    } else if (e["event"] == "register") {
      $('#uc_registration').show();
      UCState = UCStates.REGISTRATION_INPUT;
    } else if (e["event"] == "geonote_new") {
      $('#uc_login').show();
      $('#username').focus();
      UCState = UCStates.LOGGING_IN;
      $('#uc_login_status').text("Please login to create GeoNotes");
    }
    break;

  case UCStates.LOGGING_IN:
    if (e["event"] == "login_submit") {
      //jquery has a validation plugin that could probably help us out here,
      //but you have to turn over the entire form to it.  So we reinvent that
      //wheel here.
      username = $("#uc_login_form input[name=username]").val();
      password = $("#uc_login_form input[name=password]").val();
      auth = "Basic " + $.base64.encode(username + ":" + password);
      if (username == "" || password == "") {
        $("#uc_login_status").text("ERROR: Username and Password are required");
        return;
      }
      $("#uc_login_status").text("Authenticating...");
      req = $.ajax({
        url: baseURL + '/users/' + username + '/',
        type: 'GET',
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", auth);
        },
        success: function(data) {uc({event: "auth_success", data: data});},
        error: function(xhr, status, error) {
          uc({event: "auth_fail", error: error});
        }
      });
      UCState = UCStates.AUTHENTICATING;
    } else if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    }
    break;

  case UCStates.AUTHENTICATING:
    if (e["event"] == "auth_fail") {
      $("#uc_login_status").text(auth_msg[e['error']]);
      UCState = UCStates.LOGGING_IN;
    } else if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    } else if (e["event"] == "auth_success") {
      // TODO: Here we assume a well behaved server.  Is that okay?
      for (var i=0; i<e['data'].length; i++) {
        if (e['data'][i].name == "geonotes") {
          $("#uc_login_status").text("Loading Layer...");
          req = $.ajax({
            url: e['data'][i].uri,
            type: 'GET',
            beforeSend: function (xhr) {
              xhr.setRequestHeader("Authorization", auth);
            },
            success: function(data) {uc({event: "load_success", data: data});},
            error: function(xhr, status, error) {
              uc({event: "load_fail", error: error});
            }
          });
          UCState = UCStates.LOADING_LAYER;
          return;
        }
      }
      $("#uc_login_status").text("ERROR: No  geonotes layer.");
      UCState = UCStates.LOGGING_IN;
    }
    break;

  case UCStates.LOADING_LAYER:
    if (e["event"] == "load_fail") {
      $("#uc_login_status").text(auth_msg[e['error']]);
      UCState = UCStates.LOGGING_IN;
    } else if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    } else if (e["event"] == "load_success") {
      if (e['data'] == "" && e['data'].length == 0) {
        uc_set_logged_in();
        UCState = UCStates.LOGGED_IN;
        break;
      }
      $("#uc_login_status").text("Loading GeoNotes...");
      numGeoNotes = e['data'].length;
      UCState = UCStates.LOADING_GEONOTES;
      for (var i=0; i<numGeoNotes; i++) {
        console.log("Loading " + JSON.stringify(e['data'][i]));
        gnReqs.push($.ajax({
          url: e['data'][i].uri,
          type: 'GET',
          beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", auth);
          },
          success: function(data) {
            uc({event: "geonote_success", data: data});},
          error: function(xhr, status, error) {
            uc({event: "geonote_fail", error: error});
          }
        }));
      }
    }
    break;

  case UCStates.LOADING_GEONOTES:
    if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
      for (var i=0; i<gnReqs.length; i++)
        gnReqs[i].abort();
      gnReqs = [];
      numGeoNotes = 0;
      break;
    }

    if (e["event"] == "geonote_fail") {
      console.log("WARNING: Failed to load a GeoNote")
    } else if (e["event"] == "geonote_success") {
      p = formatter.read(JSON.parse(e["data"]["point"]), "Geometry");
      gnote = new GeoNote(new OpenLayers.LonLat(p.x, p.y), e["data"]["note"], e["data"]["uri"]);
      notes.addFeatures(gnote);
    }
    numGeoNotes--;
    if (numGeoNotes == 0) {
      uc_set_logged_in();
      UCState = UCStates.LOGGED_IN;
    }
    break;

  case UCStates.REGISTRATION_INPUT:
    if (e["event"] == "reg_submit") {

      //Again: jquery (or other) validation tool could be used here
      username = $("#uc_reg_form input[name=username]").val();
      password1 = $("#uc_reg_form input[name=password1]").val();
      password2 = $("#uc_reg_form input[name=password2]").val();
      if (username == "" || password1 == "" || password2 == "") {
        $("#uc_reg_status").text("ERROR: All fields are required");
        return;
      }
      if (password1 != password2) {
        $("#uc_reg_status").text("ERROR: Passwords do not match");
        return;
      }
      password = password1;
      $("#uc_reg_status").text("Registering...");
      req = $.ajax({
        url: baseURL + '/users/',
        type: 'POST',
        data: {username: username, password: password},
        success: function() {uc({event: "reg_success"});},
        error: function(xhr, status, error) {
          uc({event: "reg_fail", error: error});
        }
      });
      UCState = UCStates.REGISTERING;

    } else if (e["event"] == "reg_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    }
    break;

  case UCStates.REGISTERING:
    if (e["event"] == "reg_fail") {
      $("#uc_reg_status").text(reg_msg[e['error']]);
      UCState = UCStates.REGISTRATION_INPUT;
    } else if (e["event"] == "reg_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    } else if (e["event"] == "reg_success") {
      // TODO: This is terrible.  When a user registers, we create a layer
      // called "geonotes" which is the sole layer that we use in this client.
      // The right way to do this is to invent some additional UI (drop-down
      // menu at geonote creation time?).  Without this, we do a bunch of stuff
      // behind the users back.  And we aren't very good about backing out if
      // registration succeeds but layer creation fails.
      auth = "Basic " + $.base64.encode(username + ":" + password);
      req = $.ajax({
        url: baseURL + '/users/' + username + '/',
        type: 'POST',
        data: {layer: "geonotes"},
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", auth);
        },
        success: function() {uc({event: "layer_success"});},
        error: function(xhr, status, error) {
          uc({event: "layer_fail", error: error});
        }
      });
      UCState = UCStates.CREATING_LAYER;
    }
    break;

  case UCStates.CREATING_LAYER:
    if (e["event"] == "layer_fail") {
      $("#uc_reg_status").text(reg_msg[e['error']]);
      UCState = UCStates.REGISTRATION_INPUT;
    } else if (e["event"] == "reg_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    } else if (e["event"] == "layer_success") {
      uc_set_logged_in();
      UCState = UCStates.LOGGED_IN;
    }
    break;

  case UCStates.LOGGED_IN:
    if (e["event"] == "logout") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    } else if (e["event"] == "geonote_new") {
      gnote = new GeoNote(e["lonlat"]);
      notes.addFeatures(gnote);
      //fake a click so geonote dialog appears
      gnote.clickHandler();
      UCState = UCStates.CREATING_GNOTE;
    } else if (e["event"] == "geonote_cancel") {
      selectControl.unselect(gnote);
      UCState = UCStates.CANCELLING_GEONOTE;
    } else if (e["event"] == "geonote_update") {
      $("#uc_geonote_status").text("Updating GeoNote...");
      note = $("textarea#geonote_new").val();
      req = $.ajax({
        url: gnote.uri,
        type: 'PUT',
        data: {note:note, lat:gnote.lat, lon:gnote.lon},
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", auth);
        },
        success: function() {uc({event: "geonote_success"}, gnote);},
        error: function(xhr, status, error) {
          uc({event: "geonote_fail", error: error});
        }
      });
      gnote.note = note;
      UCState = UCStates.STORING_GNOTE;
    } else if (e["event"] == "geonote_delete") {
      $("#uc_geonote_status").text("Deleting GeoNote...");
      note = $("textarea#geonote_new").val();
      req = $.ajax({
        url: gnote.uri,
        type: 'DELETE',
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", auth);
        },
        success: function() {uc({event: "geonote_deleted"}, gnote);},
        error: function(xhr, status, error) {
          uc({event: "geonote_fail", error: error});
        }
      });
      gnote.note = note;
      UCState = UCStates.DELETING_GEONOTE;
    }
    break;

  case UCStates.CREATING_GNOTE:
    if (e["event"] == "geonote_cancel") {
      selectControl.unselect(gnote);
      notes.removeFeatures(gnote);
      UCState = UCStates.LOGGED_IN;
    } else if (e["event"] == "geonote_submit") {
      $("#uc_geonote_status").text("Saving GeoNote...");
      note = $("textarea#geonote_new").val();
      gnote.note = note;
      req = $.ajax({
        url: baseURL + '/users/' + username + '/geonotes/',
        type: 'POST',
        data: {note:note, lat:gnote.lat, lon:gnote.lon},
        beforeSend: function (xhr) {
          xhr.setRequestHeader("Authorization", auth);
        },
        success: function() {uc({event: "geonote_success"}, gnote);},
        error: function(xhr, status, error) {
          uc({event: "geonote_fail", error: error});
        }
      });
      UCState = UCStates.STORING_GNOTE;
    }
    break;

  case UCStates.CANCELLING_GEONOTE:
    // Ugh.  I always get a spurious click event after closing the popup.  I've
    // tried a billion things and I'm giving up.  So this dumb state is just a
    // pass-through state so we can dump the unexpected geonote_new event that
    // comes after cancelling.
    UCState = UCStates.LOGGED_IN;
    break;

  case UCStates.STORING_GNOTE:
    if (e["event"] == "geonote_fail") {
      $("#uc_geonote_status").text(reg_msg[e['error']]);
      UCState = UCStates.CREATING_GNOTE;
    } else if (e["event"] == "geonote_cancel") {
      selectControl.unselect(gnote);
      notes.removeFeatures(gnote);
      UCState = UCStates.LOGGED_IN;
    } else if (e["event"] == "geonote_success") {
      selectControl.unselect(gnote);
      UCState = UCStates.LOGGED_IN;
    }
    break;

  case UCStates.DELETING_GEONOTE:
    if (e["event"] == "geonote_fail") {
      $("#uc_geonote_status").text("Failed to delete GeoNote");
      UCState = UCStates.LOGGED_IN;
    } else if (e["event"] == "geonote_cancel") {
      selectControl.unselect(gnote);
      UCState = UCStates.LOGGED_IN;
    } else if (e["event"] == "geonote_deleted") {
      selectControl.unselect(gnote);
      notes.removeFeatures(gnote);
      UCState = UCStates.LOGGED_IN;
    }
    break;

  default:
    console.log("ERROR: Unexpected user controller state: " + UCState)
  }
}

$(document).ready(function() {

  console.log("OpenLayers Version: " + OpenLayers.VERSION_NUMBER);

  map = new OpenLayers.Map({
    div: "map",
    allOverlays: true
  });

  var osm = new OpenLayers.Layer.OSM();
  osm.displayInLayerSwitcher = false;
  map.addLayers([osm]);

  map.addControl(new OpenLayers.Control.LayerSwitcher());


  // For some reason, possibly due to the size of the map div, we see aliased
  // copies of the world map.  Here we work around that by setting the extent.
  var proj = new OpenLayers.Projection("EPSG:4326");
  var bounds = new OpenLayers.Bounds(-180, -59, 180, 72)
  bounds.transform(proj, map.getProjectionObject());
  map.zoomToExtent(bounds);

  notes = new OpenLayers.Layer.Vector("GeoNotes");
  map.addLayer(notes);

  console.log("OSM Extent: " + osm.getExtent().transform(map.getProjectionObject(), proj));

  // Activate the map click handler first.  This gives it the lowest precedence
  // to handle clicks.
  var click = new OpenLayers.Control.Click();
  map.addControl(click);
  click.activate();

  // Add control to select notes
  selectControl = new OpenLayers.Control.SelectFeature(
    [notes],
    {
      clickout: true, toggle: false,
      multiple: false, hover: false,
    }
  );

  map.addControl(selectControl);
  selectControl.activate();

  notes.events.on({
    "featureselected": function(e) {
      e.feature.clickHandler();
    },
    "featureunselected": function(e) {
      e.feature.unClickHandler();
    },
  });

  // Set up user controller handlers
  $("a").filter(".uc").each(function(index) {
    $(this).click(function() {
      uc({"event":$(this).attr('id')});
    });
  });

  // initialize the uc controller
  uc({"event":"init"});

});
