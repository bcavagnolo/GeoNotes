var map;

function init() {

  console.log("OpenLayers Version: " + OpenLayers.VERSION_NUMBER);

  map = new OpenLayers.Map({
    div: "map",
    allOverlays: true
  });

  var osm = new OpenLayers.Layer.OSM();
  map.addLayers([osm]);

  map.addControl(new OpenLayers.Control.LayerSwitcher());
  map.zoomToMaxExtent();

  console.log("OSM Extent: " + osm.getExtent());
}
