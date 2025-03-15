(function(){

    // Pseudo-global variables
    var attrArray = [
        "2005", "2014", "2015", "2016", "2017",
        "2018", "2019", "2020", "2021", "2022"
    ];
    // Pick which year to start with (Should change if I add a year selector)
    var expressed = attrArray[attrArray.length - 2];

    window.onload = setMap;

    //==========================================
    //CREATE MAP (600×600) & LOAD DATA
    //==========================================
    function setMap(){
        // Fixed dimensions for the map container
        var mapWidth = 600,
            mapHeight = 600;

        // Create the SVG container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        // Append a background rectangle to fill the SVG.
        map.append("rect")
            .attr("width", mapWidth)
            .attr("height", mapHeight)
            .attr("fill", "#808080"); 

        // Load data (CSV and TopoJSON)
        var promises = [
            d3.csv("data/traffic_deaths.csv"),   // CSV with 'name' and yearly attributes
            d3.json("data/states.topojson")        // TopoJSON with an object "states"
        ];
        Promise.all(promises).then(callback);

        function callback(dataArray){
            var csvData  = dataArray[0],
                topoData = dataArray[1];

            // Convert TopoJSON -> GeoJSON
            var usStates = topojson.feature(topoData, topoData.objects.states);

            // Join CSV data to GeoJSON features
            usStates.features = joinData(usStates.features, csvData);

            // Create an Albers USA projection and use fitExtent for a small margin
            var projection = d3.geoAlbersUsa();
            projection.fitExtent([[20, 20], [mapWidth - 10, mapHeight - 10]], usStates);

            // Create path generator
            var path = d3.geoPath().projection(projection);

            // Build the modern blue color scale
            var colorScale = makeColorScale(csvData);

            // Add states to the map
            map.selectAll(".state")
                .data(usStates.features)
                .enter()
                .append("path")
                .attr("class", "state")
                .attr("d", path)
                .style("fill", function(d){
                    var val = d.properties[expressed];
                    return val ? colorScale(val) : "#ccc";
                });

            // Add the scrollable horizontal bar chart
            setChart(csvData, colorScale);
        }
    }

    //==========================================
    // JOIN CSV DATA TO GEOJSON
    //==========================================
    function joinData(geojsonFeatures, csvData){
        for (var i = 0; i < csvData.length; i++){
            var csvRow = csvData[i];
            var csvKey = csvRow.name; // e.g., "Alabama"

            // Find matching feature in GeoJSON
            for (var j = 0; j < geojsonFeatures.length; j++){
                var props = geojsonFeatures[j].properties;
                if (props.name === csvKey){
                    // Transfer each attribute value from CSV to GeoJSON
                    attrArray.forEach(function(attr){
                        props[attr] = parseFloat(csvRow[attr]);
                    });
                    break;
                }
            }
        }
        return geojsonFeatures;
    }

    //==========================================
    // MAKE COLOR SCALE 
    //==========================================
    function makeColorScale(data){
        // Modern sequential blue color scheme
        var colorClasses = [
            "#f1eef6",
            "#bdc9e1",
            "#74a9cf",
            "#2b8cbe",
            "#045a8d"
        ];

        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        var domainArray = [];
        data.forEach(function(d){
            var val = parseFloat(d[expressed]);
            if (!isNaN(val)){
                domainArray.push(val);
            }
        });
        colorScale.domain(domainArray);
        return colorScale;
    }
//==========================================
// SCROLLABLE HORIZONTAL BAR CHART
//==========================================
function setChart(csvData, colorScale){
    var chartWidth = 500,
        chartHeight = 600;

    // Calculate total space needed for all bars
    var barHeight = 20,
        barGap = 5,
        totalBarSpace = (barHeight + barGap) * csvData.length;

    // Define margins for axes, title, etc.
    var margin = { top: 30, right: 20, bottom: 60, left: 120 };
    var innerWidth = chartWidth - margin.left - margin.right,
        innerHeight = totalBarSpace;  // space reserved for bars

    // Compute overall SVG height (bars + margins)
    var svgHeight = totalBarSpace + margin.top + margin.bottom;

    // Create a scrollable container <div> for the chart
    var chartContainer = d3.select("body")
        .append("div")
        .attr("class", "chartContainer")
        .style("width", chartWidth + "px")
        .style("height", chartHeight + "px")
        .style("overflow-y", "scroll");

    // Create an SVG inside the container with the computed height
    var svg = chartContainer.append("svg")
        .attr("class", "chartSVG")
        .attr("width", chartWidth)
        .attr("height", svgHeight);

    // Append a group for the entire chart content and shift by margins
    var chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Append the chart title at the top of chartGroup
    chartGroup.append("text")
        .attr("class", "chartTitle")
        .attr("x", 0)
        .attr("y", 0)
        .text(`Traffic Deaths (${expressed}) by State`);

    // Define a gap (in pixels) between the title and the first bar
    var titleGap = 20;

    // Append a group for the bars and axes, shifted down by the titleGap
    var barsGroup = chartGroup.append("g")
        .attr("transform", `translate(0,${titleGap})`);

    // Create a tooltip div 
    var tooltip = d3.select("body").selectAll("div.tooltip").data([0]);
    tooltip = tooltip.enter().append("div")
        .attr("class", "tooltip")
        .merge(tooltip)
        .style("opacity", 0);

    // Sort the data by numeric value descending
    csvData.sort(function(a, b){
        return b[expressed] - a[expressed];
    });

    // xScale for numeric values
    var maxVal = d3.max(csvData, function(d){
        return +d[expressed];
    });
    var xScale = d3.scaleLinear()
        .range([0, innerWidth])
        .domain([0, maxVal])
        .nice();

    // yScale for state names 
    var yScale = d3.scaleBand()
        .range([0, innerHeight - titleGap])
        .domain(csvData.map(d => d.name))
        .padding(0.1);

    // Draw horizontal bars in the barsGroup with tooltip events
    barsGroup.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.name))
        .attr("width", d => xScale(+d[expressed]))
        .attr("height", yScale.bandwidth())
        .style("fill", d => {
            var val = +d[expressed];
            return val ? colorScale(val) : "#ccc";
        })
        .on("mouseover", function(event, d){
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html("Total Deaths: " + d[expressed])
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(){
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Left axis for state names
    var yAxis = d3.axisLeft(yScale);
    barsGroup.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    // Bottom axis for numeric values with rotated labels
    var xAxis = d3.axisBottom(xScale);
    barsGroup.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${innerHeight - titleGap})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.15em");
}

})();
