
export const tutorialSteps = {
  dashboard: [
    {
      title: "Welcome to Your Creative Hub!",
      description: "This is your main dashboard where you'll discover posts, find collaboration opportunities, and see what's happening in the community.",
      tips: [
        "The feed shows the latest posts from creators like you",
        "Look for 'Open Requests' to find collaboration opportunities",
        "Use the search and filters to find specific content"
      ]
    },
    {
      title: "Open Requests Section",
      description: "This section shows creators who are actively looking for team members or feedback. It's a great place to find collaboration opportunities!",
      tips: [
        "Blue badges mean they're looking for team members",
        "Purple badges mean they want feedback on their work",
        "Click 'Join Team' or 'Give Feedback' to get involved"
      ]
    },
    {
      title: "Team Applications",
      description: "When others apply to join your projects, their applications will appear here. You can accept or decline team members.",
      tips: [
        "Review applications carefully",
        "Check their portfolio links if provided",
        "Accepted members become collaborators on your project"
      ]
    },
    {
      title: "Post Feed",
      description: "This is where you'll see all the creative posts from the community. You can like, comment, and interact with others' work.",
      tips: [
        "Heart button to like posts",
        "Comment button to join discussions",
        "Copy link to share interesting posts"
      ]
    }
  ],
  
  workspace: [
    {
      title: "Your Personal Workspace",
      description: "This is your creative space where all your posts, projects, and work are organized. Think of it as your portfolio!",
      tips: [
        "All your created posts appear here",
        "Edit your profile to showcase your skills",
        "Keep your bio updated to attract collaborators"
      ]
    },
    {
      title: "Profile Management",
      description: "Your profile is how others see you in the community. Make it compelling to attract the right collaborators!",
      tips: [
        "Add a professional photo or avatar",
        "Write a clear bio about your interests",
        "List your skills and expertise"
      ]
    }
  ],
  
  create: [
    {
      title: "Share Your Creativity",
      description: "This is where the magic happens! Create discussions, share files, build folders, or link GitHub repositories.",
      tips: [
        "Discussions are great for brainstorming and feedback",
        "Files let you share your actual work",
        "Folders help organize related content"
      ]
    },
    {
      title: "Types of Posts",
      description: "Choose the right type for your content. Each serves different purposes in building your creative portfolio.",
      tips: [
        "Discussions: Ideas, questions, brainstorming",
        "Files: Finished work, designs, code",
        "Folders: Project collections, portfolios"
      ]
    },
    {
      title: "Requesting Help",
      description: "After creating a post, you can request feedback or team members. This turns your post into a collaboration opportunity!",
      tips: [
        "Be specific about what help you need",
        "Define roles clearly for team requests",
        "Respond promptly to applications"
      ]
    }
  ],
  
  community: [
    {
      title: "Find Your Creative Tribe",
      description: "The community section helps you discover like-minded creators and join guilds that match your interests.",
      tips: [
        "Browse and join guilds based on your interests",
        "Create your own guild to start a new community",
        "Engage in guild discussions to build your network"
      ]
    },
    {
      title: "What are Guilds?",
      description: "Guilds are communities built around shared interests, skills, or goals. They are a great place to collaborate and learn from others.",
      tips: [
        "Each guild has its own posts and quest board",
        "Participate in guild activities to get involved",
        "Connect with other members of your guilds"
      ]
    }
  ],
  
  activity: [
    {
      title: "Track Your Creative Journey",
      description: "The activity feed shows all the interactions and progress across the platform. It's like a timeline of creativity!",
      tips: [
        "See when people interact with your posts",
        "Track collaboration progress",
        "Stay updated on community activity"
      ]
    },
    {
      title: "Notifications & Invites",
      description: "Important notifications like guild invites and collaboration requests appear here. Stay on top of opportunities!",
      tips: [
        "Check regularly for new opportunities",
        "Respond promptly to invitations",
        "Use filters to find specific activities"
      ]
    }
  ]
};

export const getStepsForPage = (pageName) => {
  return tutorialSteps[pageName] || [];
};
