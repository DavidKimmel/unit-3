(function(){

    // Pseudo-global variables
    var attrArray = [
        "2005", "2014", "2015", "2016", "2017",
        "2018", "2019", "2020", "2021", "2022"
    ];
    // Pick which year to start with
    var expressed = attrArray[attrArray.length - 10];

    // An object to store references to chart scales and groups
    var chartProps = {}; // will hold xScale, yScale, barsGroup, etc.

    // When the page loads, call setMap
    window.onload = setMap;

    //==========================================
    // CREATE MAP (600×600) & LOAD DATA
    //==========================================
    function setMap(){
        var mapWidth = 800,
            mapHeight = 600;

        // Create the SVG container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .style("float", "left")
            .style("margin-right", "20px")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        // Create a group for the states (so zoom applies to them)
        var statesGroup = map.append("g")
            .attr("class", "statesGroup");

        // Define zoom-related variables and functions in the setMap scope
        var active = d3.select(null);
        var zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", zoomed);
        map.call(zoom);

        function zoomed(event) {
            statesGroup.attr("transform", event.transform);
        }

        function resetZoom() {
            active.classed("active", false);
            active = d3.select(null);
            map.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        }

        // Append the background rectangle AFTER defining resetZoom so it's available
        map.append("rect")
            .attr("width", mapWidth)
            .attr("height", mapHeight)
            .attr("fill", "rgb(255, 255, 255)")
            .lower()  // ensure it is behind the states
            .on("click", resetZoom);

        // Create a tooltip for the map
        var mapTooltip = d3.select("body").append("div")
            .attr("class", "tooltip")

        // Load data (CSV and TopoJSON)
        var promises = [
            d3.csv("data/traffic_deaths.csv"),
            d3.json("data/states.topojson")
        ];
        Promise.all(promises).then(callback);

        function callback(dataArray){
            var csvData  = dataArray[0],
                topoData = dataArray[1];

            // Convert TopoJSON -> GeoJSON and join CSV data
            var usStates = topojson.feature(topoData, topoData.objects.states);
            usStates.features = joinData(usStates.features, csvData);

            // Create an Albers USA projection and fit it to the map dimensions
            var projection = d3.geoAlbersUsa()
                .fitExtent([[20, 20], [mapWidth - 10, mapHeight - 10]], usStates);
            var path = d3.geoPath().projection(projection);

            var colorScale = makeColorScale(csvData);

            // Add states to the statesGroup with zoom-on-click behavior
            statesGroup.selectAll(".state")
                .data(usStates.features)
                .enter()
                .append("path")
                .attr("class", "state")
                .attr("d", path)
                .style("fill", function(d){
                    var val = d.properties[expressed];
                    return val ? colorScale(val) : "#ccc";
                })
                .style("stroke", "#2e2b2b")
                .style("stroke-width", ".7")
                .on("mouseover", function(event, d){
                    d3.select(this)
                      .style("stroke", "orange")
                      .style("stroke-width", "2");
                    mapTooltip.transition()
                        .duration(200)
                    mapTooltip.html("Total Deaths: <strong>" + d.properties[expressed] + "</strong>")
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function(event, d){
                    d3.select(this)
                      .style("stroke", "#2e2b2b")
                      .style("stroke-width", ".7");
                    mapTooltip.transition()
                        .duration(500)
                })
                .on("click", clicked);

            function clicked(event, d){
                // If the clicked state is already active, reset zoom
                if (active.node() === this) return resetZoom();
                active.classed("active", false);
                active = d3.select(this).classed("active", true);

                var bounds = path.bounds(d),
                    dx = bounds[1][0] - bounds[0][0],
                    dy = bounds[1][1] - bounds[0][1],
                    x = (bounds[0][0] + bounds[1][0]) / 2,
                    y = (bounds[0][1] + bounds[1][1]) / 2,
                    scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / mapWidth, dy / mapHeight))),
                    translate = [mapWidth/2 - scale * x, mapHeight/2 - scale * y];

                map.transition()
                   .duration(750)
                   .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
            }

            // Create the horizontal bar chart and dropdown as before
            setChart(csvData, colorScale);
            createDropdown(csvData, mapWidth, mapHeight);
        }
    }

    //==========================================
    // JOIN CSV DATA TO GEOJSON
    //==========================================
    function joinData(geojsonFeatures, csvData){
        for (var i = 0; i < csvData.length; i++){
            var csvRow = csvData[i];
            var csvKey = csvRow.name;
            for (var j = 0; j < geojsonFeatures.length; j++){
                var props = geojsonFeatures[j].properties;
                if (props.name === csvKey){
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
        var colorClasses = [
            "#f1eef6",
            "#bdc9e1",
            "#74a9cf",
            "#2b8cbe",
            "#045a8d"
        ];
        var colorScale = d3.scaleQuantile().range(colorClasses);
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
        var barHeight = 20,
            barGap = 5,
            totalBarSpace = (barHeight + barGap) * csvData.length;
        var margin = { top: 30, right: 20, bottom: 60, left: 120 };
        var innerWidth = chartWidth - margin.left - margin.right,
            innerHeight = totalBarSpace;
        var svgHeight = totalBarSpace + margin.top + margin.bottom;
        var chartContainer = d3.select("body")
            .append("div")
            .attr("class", "chartContainer")
            .style("float", "left")
            .style("width", chartWidth + "px")
            .style("height", chartHeight + "px")
            .style("overflow-y", "scroll");
        var svg = chartContainer.append("svg")
            .attr("class", "chartSVG")
            .attr("width", chartWidth)
            .attr("height", svgHeight);
        var chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        chartGroup.append("text")
            .attr("class", "chartTitle")
            .attr("x", 0)
            .attr("y", 0)
            .text(`Traffic Deaths (${expressed}) by State`);
        var titleGap = 20;
        var barsGroup = chartGroup.append("g")
            .attr("class", "barsGroup")
            .attr("transform", `translate(0,${titleGap})`);
        csvData.sort(function(a, b){
            return b[expressed] - a[expressed];
        });
        var maxVal = d3.max(csvData, d => +d[expressed]);
        var xScale = d3.scaleLinear()
            .range([0, innerWidth])
            .domain([0, maxVal])
            .nice();
        var yScale = d3.scaleBand()
            .range([0, innerHeight - titleGap])
            .domain(csvData.map(d => d.name))
            .padding(0.1);
        var bars = barsGroup.selectAll(".bar")
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
            });
        var tooltip = d3.select("body").selectAll("div.tooltip").data([0]);
        tooltip = tooltip.enter().append("div")
            .attr("class", "tooltip")
            .merge(tooltip)
        bars.on("mouseover", function(event, d){
                tooltip.transition()
                    .duration(200)
                tooltip.html("Total Deaths: <strong>" + d[expressed] + "</strong>")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(){
                tooltip.transition()
                    .duration(500)
            });
        var yAxis = d3.axisLeft(yScale);
        barsGroup.append("g")
            .attr("class", "y axis")
            .call(yAxis);
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
        chartProps.xScale = xScale;
        chartProps.yScale = yScale;
        chartProps.barsGroup = barsGroup;
        chartProps.innerWidth = innerWidth;
        chartProps.innerHeight = innerHeight;
        chartProps.titleGap = titleGap;
        chartProps.margin = margin;
    }

    //==========================================
    // CREATE DROPDOWN MENU
    //==========================================
    function createDropdown(csvData, mapWidth, mapHeight){
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData);
            });
        dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Year");
        dropdown.selectAll("option.attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", d => d)
            .text(d => d);
    }

    //==========================================
    // CHANGE ATTRIBUTE EVENT HANDLER
    //==========================================
    function changeAttribute(attribute, csvData){
        expressed = attribute;
        var colorScale = makeColorScale(csvData);
        d3.selectAll(".state")
            .transition()
            .duration(750)
            .style("fill", function(d){
                var val = d.properties[expressed];
                return val ? colorScale(val) : "#ccc";
            });
        csvData.sort(function(a, b){
            return b[expressed] - a[expressed];
        });
        var maxVal = d3.max(csvData, d => +d[expressed]);
        chartProps.xScale.domain([0, maxVal]).nice();
        chartProps.yScale.domain(csvData.map(d => d.name));
        var bars = chartProps.barsGroup.selectAll(".bar")
            .data(csvData, d => d.name)
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            });
        bars.transition()
            .delay((d, i) => i * 10)
            .duration(500)
            .attr("y", d => chartProps.yScale(d.name))
            .attr("width", d => chartProps.xScale(+d[expressed]))
            .style("fill", d => {
                var val = +d[expressed];
                return val ? colorScale(val) : "#ccc";
            });
        chartProps.barsGroup.select(".x.axis")
            .transition()
            .duration(500)
            .call(d3.axisBottom(chartProps.xScale))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .attr("text-anchor", "end")
            .attr("dx", "-0.5em")
            .attr("dy", "0.15em");
        chartProps.barsGroup.select(".y.axis")
            .transition()
            .duration(500)
            .call(d3.axisLeft(chartProps.yScale));
        d3.select(".chartTitle")
            .text(`Traffic Deaths (${expressed}) by State`);
    }

})();
