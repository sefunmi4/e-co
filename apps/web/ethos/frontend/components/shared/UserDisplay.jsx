import React from "react";

export function getUserDisplayName(userOrEmail) {
  if (!userOrEmail) return "Unknown User";
  
  // If it's a user object, prefer username, fallback to full name, then email prefix
  if (typeof userOrEmail === 'object') {
    if (userOrEmail.username) return userOrEmail.username;
    if (userOrEmail.full_name) return userOrEmail.full_name;
    return userOrEmail.email ? userOrEmail.email.split('@')[0] : "Unknown User";
  }
  
  // If it's just an email string, extract the prefix for now
  if (typeof userOrEmail === 'string') {
    return userOrEmail.split('@')[0];
  }
  
  return "Unknown User";
}

export function UserDisplay({ user, showEmail = false, className = "" }) {
  if (!user) return <span className={className}>Unknown User</span>;
  
  const displayName = getUserDisplayName(user);
  
  return (
    <span className={className}>
      {displayName}
      {showEmail && user.email && user.username && (
        <span className="text-gray-500 text-sm ml-1">({user.email})</span>
      )}
    </span>
  );
}

export default UserDisplay;