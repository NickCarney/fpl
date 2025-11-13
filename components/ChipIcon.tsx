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
          icon: "TC",
          title: "Triple Captain",
          color: "text-yellow-600",
        };
      case "bboost":
        return { icon: "BB", title: "Bench Boost", color: "text-blue-600" };
      case "wildcard":
        return { icon: "WC", title: "Wildcard", color: "text-purple-600" };
      case "freehit":
        return { icon: "FH", title: "Free Hit", color: "text-green-600" };
      default:
        return null;
    }
  };

  const chipData = getChipDisplay(chip);

  if (!chipData) return null;

  return (
    <div
      className="relative inline-block min-w-[2rem] min-h-[2rem] flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className={`${chipData.color} ${className} cursor-help text-lg font-semibold`}
      >
        {chipData.icon}
      </span>

      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-50 shadow-lg pointer-events-none">
          {chipData.title}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}
