var map;
var notes; // layer for geonote markers

// These are some one-time initializations for the GeoNotes
var size = new OpenLayers.Size(21,25);
var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);
var formatter = new OpenLayers.Format.GeoJSON();

// This is the state for the broadcast management
var socket;

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
    console.log(this.lat);
    console.log(this.lon);
    alert("You clicked a geonote at " + this.lat + " " + this.lon);
  },

  announce: function() {
    point = new OpenLayers.Geometry.Point(this.lon, this.lat);
    gjson = formatter.write(point);
    socket.emit('new geonote', gjson);
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
      console.log("selected note " + e.feature.id);
    },
    "featureunselected": function(e) {
      console.log("unselected note " + e.feature.id);
    },
  });

  socket = io.connect();
  socket.on('new geonote', function (data) {
    console.log(data);
    notes.addFeatures(formatter.read(data));
  });

});
