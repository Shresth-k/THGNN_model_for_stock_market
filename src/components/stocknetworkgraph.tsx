import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';
import _ from 'lodash';

// Fallback data if file loading fails
const fallbackData = [
  { stock1: "MARUTI", stock2: "M&M", relation_type: "sector", weight: 0.9 },
  { stock1: "MARUTI", stock2: "TATAMOTORS", relation_type: "sector", weight: 0.9 },
  { stock1: "MARUTI", stock2: "BAJAJ-AUTO", relation_type: "sector", weight: 0.9 },
  // Add more entries as needed
  // You can include a subset of the most important relationships
];

const StockNetworkGraph = () => {
  const svgRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relationThreshold, setRelationThreshold] = useState(0);
  const [repulsionForce, setRepulsionForce] = useState(-300);
  const [linkDistance, setLinkDistance] = useState(100);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [simulation, setSimulation] = useState(null);

  // Load and parse CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Try to fetch the file
        const response = await fetch('/src/backend/stock_relationships.csv');
        
        if (!response.ok) {
          // If fetch fails, use fallback data
          processData(fallbackData);
          setLoading(false);
          return;
        }
        
        const text = await response.text();
        
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const stockData = results.data;
            processData(stockData);
            setLoading(false);
          },
          error: (error) => {
            // If parsing fails, use fallback data
            console.error(`Error parsing CSV: ${error.message}`);
            processData(fallbackData);
            setLoading(false);
          }
        });
      } catch (error) {
        // If any error occurs, use fallback data
        console.error(`Error loading file: ${error.message}`);
        processData(fallbackData);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Process data to create nodes and links
  const processData = (data) => {
    const uniqueStocks = new Set();
    
    // Collect all unique stocks
    data.forEach(row => {
      if (row.stock1) uniqueStocks.add(row.stock1);
      if (row.stock2) uniqueStocks.add(row.stock2);
    });
    
    // Create nodes
    const nodes = Array.from(uniqueStocks).map(stock => ({
      id: stock,
      group: determineGroup(stock, data)
    }));
    
    // Create links
    const links = data.map(row => ({
      source: row.stock1,
      target: row.stock2,
      type: row.relation_type,
      value: row.weight || 1
    }));
    
    // Determine groups for color coding
    const groupArray = _.uniqBy(nodes, 'group')
      .map(node => node.group)
      .filter(group => group);
    
    setGroups(groupArray);
    setGraphData({ nodes, links });
  };

  // Helper function to determine group based on relationship patterns
  const determineGroup = (stock, data) => {
    // This is a simplified method - you may want to implement a more 
    // sophisticated grouping algorithm based on your data
    const relations = data.filter(row => 
      row.stock1 === stock || row.stock2 === stock
    );
    
    // If we have relation types, we can use the most common one
    if (relations.length > 0) {
      const types = relations.map(r => r.relation_type);
      return _.head(_(types).countBy().entries().maxBy(_.last));
    }
    
    return null;
  };

  // Initialize and update the force simulation
  useEffect(() => {
    if (!graphData.nodes.length || !svgRef.current) return;
    
    // Clear any existing SVG content
    d3.select(svgRef.current).selectAll("*").remove();
    
    const width = 800;
    const height = 600;
    
    // Color scale for groups
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Filter links based on threshold
    const filteredLinks = graphData.links.filter(link => 
      link.value >= relationThreshold
    );
    
    // Create a new simulation
    const sim = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(filteredLinks)
        .id(d => d.id)
        .distance(linkDistance))
      .force("charge", d3.forceManyBody().strength(repulsionForce))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);
    
    setSimulation(sim);
    
    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%");
    
    // Create container for zoom functionality
    const g = svg.append("g");
    
    // Add zoom behavior
    svg.call(d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      }));
    
    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(filteredLinks)
      .enter().append("line")
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("stroke", d => {
        // Color links based on type or group
        return d.type ? color(d.type) : "#999";
      })
      .attr("stroke-opacity", 0.6);
    
    // Create nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .enter().append("circle")
      .attr("r", 8)
      .attr("fill", d => {
        // If a group is selected, dim other nodes
        if (selectedGroup && d.group !== selectedGroup) {
          return "#ccc";
        }
        return d.group ? color(d.group) : "#999";
      })
      .call(drag(sim));
    
    // Add tooltips on hover
    node.append("title")
      .text(d => d.id);
    
    // Add text labels
    const text = g.append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .enter().append("text")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text(d => d.id)
      .style("font-size", "10px")
      .style("fill", d => {
        // If a group is selected, dim other text
        if (selectedGroup && d.group !== selectedGroup) {
          return "#ccc";
        }
        return "#000";
      });
    
    // Update positions on each tick
    function ticked() {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
        
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
        
      text
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    }
    
    // Drag behavior for nodes
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
    
    // Cleanup function
    return () => {
      if (sim) sim.stop();
    };
  }, [graphData, relationThreshold, repulsionForce, linkDistance, selectedGroup]);

  // Update simulation when controls change
  useEffect(() => {
    if (simulation) {
      simulation
        .force("link").distance(linkDistance);
      simulation
        .force("charge").strength(repulsionForce);
      simulation.alpha(0.3).restart();
    }
  }, [repulsionForce, linkDistance, simulation]);

  if (loading) {
    return <div className="text-center py-10">Loading stock relationship data...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full">
      <div className="bg-gray-800 text-white p-4 mb-4 rounded">
        <h2 className="text-xl mb-4">Network Controls</h2>
        
        <div className="mb-4">
          <label className="block mb-2">Repulsion Force</label>
          <input
            type="range"
            min="-1000"
            max="-100"
            value={repulsionForce}
            onChange={(e) => setRepulsionForce(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Link Distance</label>
          <input
            type="range"
            min="30"
            max="300"
            value={linkDistance}
            onChange={(e) => setLinkDistance(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="mb-4">
          <label className="block mb-2">Relatedness Threshold</label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={relationThreshold}
            onChange={(e) => setRelationThreshold(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
      
      {groups.length > 0 && (
        <div className="mb-4 p-4 bg-white rounded shadow">
          <h3 className="text-lg mb-2">Stock Groups</h3>
          <div className="flex flex-wrap">
            {groups.map((group, i) => (
              <button
                key={i}
                className={`m-1 px-3 py-1 rounded ${
                  selectedGroup === group ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
                onClick={() => {
                  setSelectedGroup(selectedGroup === group ? null : group);
                }}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="border rounded p-2">
        <svg 
          ref={svgRef} 
          className="w-full"
          style={{ height: "600px", backgroundColor: "#f8f9fa" }} 
        />
      </div>
    </div>
  );
};

export default StockNetworkGraph;