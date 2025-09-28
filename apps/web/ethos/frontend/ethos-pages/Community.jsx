import React from 'react';
import GuildsView from "../components/community/GuildsView";

export default function Community() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community Guilds</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Discover, join, and create communities based on your interests.</p>
        </header>
        <GuildsView />
      </div>
    </div>
  );
}