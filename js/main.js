window.onload = setMap();

function setMap(){
    var width = 960,
        height = 560;

    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

        var projection = d3.geoAlbersUsa()
        .scale(1070)
        .translate([width / 2, height / 2]);
    
    var path = d3.geoPath().projection(projection);

    // parallelize data loading
    var promises = [
        d3.csv("data/traffic_deaths.csv"),
        d3.json("data/states.topojson")
    ];
    Promise.all(promises).then(callback);

    function callback(dataArray) {
        var csvData = dataArray[0],
            topoData = dataArray[1];

        console.log(csvData);
        console.log(topoData);

        // Must match the actual key in the TopoJSON
        var usStates = topojson.feature(topoData, topoData.objects.states);
        console.log(usStates);

        // Draw the states
        map.selectAll(".state")
           .data(usStates.features)
           .enter()
           .append("path")
           .attr("class", "state")
           .attr("d", path);
    }
}
