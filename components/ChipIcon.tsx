"use client";

import { useState } from "react";

interface ChipIconProps {
  chip: string;
  className?: string;
}

export default function ChipIcon({ chip, className = "" }: ChipIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getChipDisplay = (chipType: string) => {
    switch (chipType) {
      case "3xc":
        return {
          icon: "👑",
          title: "Triple Captain",
          color: "text-yellow-600",
        };
      case "bboost":
        return { icon: "⚡", title: "Bench Boost", color: "text-blue-600" };
      case "wildcard":
        return { icon: "🃏", title: "Wildcard", color: "text-purple-600" };
      case "freehit":
        return { icon: "🎯", title: "Free Hit", color: "text-green-600" };
      default:
        return null;
    }
  };

  const chipData = getChipDisplay(chip);

  if (!chipData) return null;

  return (
    <div className="relative inline-block">
      <span
        className={`${chipData.color} ${className} cursor-help text-lg`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {chipData.icon}
      </span>

      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 shadow-lg">
          {chipData.title}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}
