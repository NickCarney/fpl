"use client";

import { useState } from "react";
import { Element, Team, ElementType } from "@/types/fpl";

interface PlayerStatsProps {
  elements: Element[];
  teams: Team[];
  elementTypes: ElementType[];
}

export default function PlayerStats({
  elements,
  teams,
  elementTypes,
}: PlayerStatsProps) {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<
    "total_points" | "form" | "now_cost" | "ict_index"
  >("total_points");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const getTeam = (teamId: number) => {
    return teams.find((team) => team.id === teamId);
  };

  const getPosition = (elementTypeId: number) => {
    return elementTypes.find((type) => type.id === elementTypeId);
  };

  const filteredAndSortedElements = elements
    .filter((element) => {
      const matchesPosition =
        selectedPosition === null || element.element_type === selectedPosition;
      const matchesSearch =
        searchTerm === "" ||
        element.web_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.second_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPosition && matchesSearch;
    })
    .sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case "total_points":
          aValue = a.total_points;
          bValue = b.total_points;
          break;
        case "form":
          aValue = parseFloat(a.form) || 0;
          bValue = parseFloat(b.form) || 0;
          break;
        case "now_cost":
          aValue = a.now_cost;
          bValue = b.now_cost;
          break;
        case "ict_index":
          aValue = parseFloat(a.ict_index) || 0;
          bValue = parseFloat(b.ict_index) || 0;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
    })
    .slice(0, 50); // Limit to top 50 for performance

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: typeof sortBy;
    children: React.ReactNode;
  }) => (
    <th
      className="text-left py-2 cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field && (
          <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Player Stats</h2>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Position
          </label>
          <select
            value={selectedPosition || ""}
            onChange={(e) =>
              setSelectedPosition(
                e.target.value ? parseInt(e.target.value) : null
              )
            }
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Positions</option>
            {elementTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.plural_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Players
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by player name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Player</th>
              <th className="text-left py-2">Team</th>
              <th className="text-left py-2">Pos</th>
              <SortableHeader field="total_points">Points</SortableHeader>
              <SortableHeader field="form">Form</SortableHeader>
              <SortableHeader field="now_cost">Price</SortableHeader>
              <SortableHeader field="ict_index">ICT</SortableHeader>
              <th className="text-right py-2">Selected %</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedElements.map((element) => {
              const team = getTeam(element.team);
              const position = getPosition(element.element_type);

              return (
                <tr key={element.id} className="border-b hover:bg-gray-50">
                  <td className="py-3">
                    <div>
                      <div className="font-medium">{element.web_name}</div>
                      <div className="text-xs text-gray-600">
                        {element.first_name} {element.second_name}
                      </div>
                    </div>
                  </td>
                  <td className="py-3">{team?.short_name}</td>
                  <td className="py-3">{position?.singular_name_short}</td>
                  <td className="py-3 font-semibold">{element.total_points}</td>
                  <td className="py-3">{element.form}</td>
                  <td className="py-3">
                    £{(element.now_cost / 10).toFixed(1)}m
                  </td>
                  <td className="py-3">{element.ict_index}</td>
                  <td className="py-3 text-right">
                    {element.selected_by_percent}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedElements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No players found matching your criteria
        </div>
      )}
    </div>
  );
}
