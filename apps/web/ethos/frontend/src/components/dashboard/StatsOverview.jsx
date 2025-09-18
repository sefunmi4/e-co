import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Target, 
  TrendingUp, 
  Users, 
  CheckCircle
} from "lucide-react";
import { motion } from "framer-motion";

const statCards = [
  {
    title: "Total Posts",
    key: "total",
    icon: Target,
    color: "text-blue-600"
  },
  {
    title: "Active", 
    key: "active",
    icon: TrendingUp,
    color: "text-green-600"
  },
  {
    title: "Completed",
    key: "completed", 
    icon: CheckCircle,
    color: "text-purple-600"
  },
  {
    title: "Avg Progress",
    key: "avgCompletion",
    icon: Users,
    color: "text-orange-600",
    suffix: "%"
  }
];

export default function StatsOverview({ stats, isLoading }) {
  return (
    <Card className="creator-card">
       <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Community Stats</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-3"
          >
            <div className="mx-auto w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                `${stats[stat.key] || 0}${stat.suffix || ''}`
              )}
            </p>
            <p className="text-xs font-medium text-gray-600">
              {stat.title}
            </p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}