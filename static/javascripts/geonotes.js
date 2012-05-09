var map;
var notes; // layer for geonote markers

// These are some one-time initializations for the GeoNotes
var size = new OpenLayers.Size(21,25);
var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);
var formatter = new OpenLayers.Format.GeoJSON();
var selectControl;

// A GeoNote is just a decorated vector feature
GeoNote = OpenLayers.Class(OpenLayers.Feature.Vector, {

  initialize: function(lonlat) {
    this.lat = lonlat.lat;
    this.lon = lonlat.lon;
    OpenLayers.Feature.Vector.prototype.initialize.apply(
      this,
      [new OpenLayers.Geometry.Point(this.lon, this.lat), null, null]
    );
    notes.addFeatures(this);
  },

  clickHandler: function (e) {
    this.popup = new OpenLayers.Popup.FramedCloud(
      this.id, 
      this.geometry.getBounds().getCenterLonLat(),
      null,
      "<div style='font-size:.8em'>Feature: " + this.id +"<br>Area: " + this.geometry.getArea()+"</div>",
      null, true, this.onPopupClose);
    map.addPopup(this.popup);
    this.popup.data = this;
  },

  onPopupClose: function (e) {
    selectControl.unselect(this.data);
  },

  unClickHandler: function (e) {
    map.removePopup(this.popup);
    this.popup.destroy();
    this.popup = null;
  },

  announce: function() {
    point = new OpenLayers.Geometry.Point(this.lon, this.lat);
    gjson = formatter.write(point);
  }
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
        'click': this.trigger
      }, this.handlerOptions
    );
  },

  trigger: function(e) {
    var lonlat = map.getLonLatFromViewPortPx(e.xy);
    (new GeoNote(lonlat)).announce();
  }
});

// This is the user controller state machine.  It should all be wrapped up in a
// class.  Oh well.
UCStates = {
  LOGGED_OUT:0,
  LOGGING_IN:1,
  LOGGED_IN:2,
  AUTHENTICATING:3,
}

UCState = UCStates.LOGGED_OUT;
var authTimer = null;

function uc_set_logged_in() {
  $('#uc_login').hide();
  $('#uc_logged_in').show();
  $('#uc_logged_out').hide();
  $("#uc_login_status").text("");
  if (authTimer) clearTimeout(authTimer);
}

function uc_set_logged_out() {
  $('#uc_login').hide();
  $('#uc_logged_in').hide();
  $('#uc_logged_out').show();
  $("#uc_login_status").text("")
  if (authTimer) clearTimeout(authTimer);
}

function uc(e) {
  console.log("User Controller State: " + UCState)
  console.log("User Controller Event: " + JSON.stringify(e))

  switch (UCState) {
  case UCStates.LOGGED_OUT:
    if (e["event"] == "init") {
      console.log("user controller initialized");
    } else if (e["event"] == "login") {
      $('#uc_login').show();
      UCState = UCStates.LOGGING_IN;
    }
    break;

  case UCStates.LOGGING_IN:
    if (e["event"] == "login_submit") {
      // TODO: Here we have a dummy function used to test the authentication
      // UI.  Ultimately, it will perform a network authentication and either
      // succeed, fail, or timeout.
      $("#uc_login_status").text("Authenticating...")
      authTimer = setTimeout(function() {uc({"event":"auth_timeout"})}, 3000);
      UCState = UCStates.AUTHENTICATING;
    } else if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    }
    break;

  case UCStates.AUTHENTICATING:
    if (e["event"] == "auth_timeout") {
      $("#uc_login_status").text("ERROR: Timed out while authenticating.")
      UCState = UCStates.LOGGING_IN;
    } else if (e["event"] == "login_cancel") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    }
    break;

  case UCStates.LOGGED_IN:
    if (e["event"] == "logout") {
      uc_set_logged_out();
      UCState = UCStates.LOGGED_OUT;
    }
    break;
  default:
    console.log("ERROR: Unexpected user controller state: " + uc_state)
  }
}

$(document).ready(function() {

  console.log("OpenLayers Version: " + OpenLayers.VERSION_NUMBER);

  map = new OpenLayers.Map({
    div: "map",
    allOverlays: true
  });

  var osm = new OpenLayers.Layer.OSM();
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
