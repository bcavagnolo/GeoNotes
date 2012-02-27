var map;
var notes; // layer for geonote markers

// These are some one-time initializations for the GeoNotes
var size = new OpenLayers.Size(21,25);
var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
var icon = new OpenLayers.Icon('http://www.openlayers.org/dev/img/marker.png', size, offset);
var formatter = new OpenLayers.Format.GeoJSON();

// This is the state for the broadcast management
var socket;

function GeoNote(lonlat) {
  this.lat = lonlat.lat;
  this.lon = lonlat.lon;

  this.clickHandler = function (e) {
    console.log(this.lat);
    console.log(this.lon);
    alert("You clicked marker at " + this.lat + " " + this.lon);
  }

  // Put up a marker on the map
  this.marker = new OpenLayers.Marker(new OpenLayers.LonLat(lonlat.lon, lonlat.lat),icon.clone());
  notes.addMarker(this.marker);
  this.marker.events.register("click", this, this.clickHandler);

  this.announce = function() {
    point = new OpenLayers.Geometry.Point(this.lon, this.lat);
    gjson = formatter.write(point);
    socket.emit('new geonote', gjson);
  }
}

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

  notes = new OpenLayers.Layer.Markers("GeoNotes");
  map.addLayer(notes);

  console.log("OSM Extent: " + osm.getExtent().transform(map.getProjectionObject(), proj));

  var click = new OpenLayers.Control.Click();
  map.addControl(click);
  click.activate();

  socket = io.connect();
  socket.on('new geonote', function (data) {
    console.log("Received:" + data);
  });

});
