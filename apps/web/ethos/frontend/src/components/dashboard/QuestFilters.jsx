import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";

export default function QuestFilters({ filters, onFilterChange }) {
  const resetFilters = () => {
    onFilterChange({
      status: "all",
      priority: "all", 
      quest_type: "all",
      difficulty: "all"
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select 
        value={filters.quest_type} 
        onValueChange={(value) => onFilterChange({...filters, quest_type: value})}
      >
        <SelectTrigger className="w-40 bg-slate-100 border-slate-200 text-slate-800">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Post Types</SelectItem>
          <SelectItem value="discussion">Discussion</SelectItem>
          <SelectItem value="project_quest">Quest</SelectItem>
          <SelectItem value="party_folder">Party Folder</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={resetFilters}
        className="border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-200"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  );
}