import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Star, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function ActiveGuilds({ guilds, isLoading }) {
  return (
    <Card className="feed-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-500" />
          Active Guilds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded mb-1"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))
        ) : guilds.length > 0 ? (
          guilds.slice(0, 5).map((guild, index) => (
            <Link key={guild.id} to={createPageUrl('GuildDetail') + `?id=${guild.id}`}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center border border-violet-200">
                    <Users className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 group-hover:text-violet-600 transition-colors">
                      {guild.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{guild.member_count || 0} members</span>
                      <span>•</span>
                      <span>{guild.quest_count || 0} posts</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
              </motion.div>
            </Link>
          ))
        ) : (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No guilds yet</p>
            <Link to={createPageUrl("Community")}>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Guild
              </Button>
            </Link>
          </div>
        )}

        {guilds.length > 0 && (
          <div className="pt-4 mt-2 border-t border-slate-100">
            <Link to={createPageUrl("Community")}>
              <Button variant="ghost" className="w-full text-violet-600 hover:text-violet-700 hover:bg-violet-50">
                View All Guilds
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}