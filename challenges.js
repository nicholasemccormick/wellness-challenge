// Challenge definitions, taken from the St. Mark Staff Wellness Challenge sheet.
// mode: "once"    = can be earned one time
//       "monthly" = can be earned once per calendar month
//       "repeat"  = earned each time; you enter how many times per month
// daily: true = at most once a day, so the monthly count is capped at the days in that month
window.CHALLENGE = {
  start: '2026-09-08',
  end: '2027-04-30',
  milestones: [10, 25, 50, 75, 100],
  // Fixed milestones in points, the same for everyone regardless of personal goal.
  pointMilestones: [3000],
  // Same order as the columns on the original sheet, left to right.
  categories: [
    { id: 'onetime', name: 'One Time' },
    { id: 'monthly', name: 'Monthly' },
    { id: 'physical', name: 'Physical' },
    { id: 'spiritual', name: 'Spiritual' },
    { id: 'mental', name: 'Mental/Emotional' }
  ],
  items: [
    // One-time
    { id: 'join', cat: 'onetime', pts: 5, mode: 'once', auto: true, text: "Join the staff wellness challenge (you've already done this!)" },
    { id: 'del_starbucks', cat: 'onetime', pts: 5, mode: 'once', text: 'Delete the Starbucks app from your phone' },
    { id: 'join_gym', cat: 'onetime', pts: 20, mode: 'once', text: 'Join a gym' },
    { id: 'dl_hallow', cat: 'onetime', pts: 5, mode: 'once', text: 'Download the Hallow app' },
    { id: 'dl_rosary', cat: 'onetime', pts: 5, mode: 'once', text: 'Download a Rosary app' },
    { id: 'del_doordash', cat: 'onetime', pts: 5, mode: 'once', text: 'Delete the DoorDash app from your phone' },
    { id: 'del_restaurant_apps', cat: 'onetime', pts: 5, mode: 'repeat', text: 'Delete any other restaurant app from your phone (5 points each)' },
    { id: 'dl_meditation', cat: 'onetime', pts: 5, mode: 'once', text: 'Download a meditation or calming app' },
    // Monthly
    { id: 'one_streaming', cat: 'monthly', pts: 10, mode: 'monthly', text: 'Only allow yourself one streaming service at a time' },
    { id: 'home_cooked', cat: 'monthly', pts: 15, mode: 'monthly', text: 'Eat only home-cooked meals for one month (no restaurants)' },
    { id: 'no_caffeine', cat: 'monthly', pts: 15, mode: 'monthly', text: 'No caffeine for a whole month' },
    { id: 'no_candy', cat: 'monthly', pts: 10, mode: 'monthly', text: 'No candy for a whole month' },
    { id: 'walk_30', cat: 'monthly', pts: 10, mode: 'monthly', text: 'Walk 30 miles in one month' },
    { id: 'workouts_15', cat: 'monthly', pts: 10, mode: 'monthly', text: 'Complete 15 workouts in one month' },
    { id: 'new_exercise', cat: 'monthly', pts: 5, mode: 'repeat', text: "Try a new exercise that you haven't done before" },
    { id: 'bible_book', cat: 'monthly', pts: 5, mode: 'repeat', text: 'Read one whole book in the Bible' },
    // Physical
    { id: 'cardio', cat: 'physical', pts: 3, mode: 'repeat', text: 'Complete a cardio workout' },
    { id: 'strength', cat: 'physical', pts: 2, mode: 'repeat', text: 'Complete a strength workout' },
    { id: 'stand', cat: 'physical', pts: 1, mode: 'repeat', daily: true, text: 'Stand up at least an hour per day' },
    { id: 'park_far', cat: 'physical', pts: 1, mode: 'repeat', text: 'Park in the farthest spot to get extra steps in' },
    { id: 'no_eat_out', cat: 'physical', pts: 1, mode: 'repeat', daily: true, text: 'Go one day without eating out' },
    { id: 'add_5lb', cat: 'physical', pts: 2, mode: 'repeat', text: 'Add five pounds to your reps when you lift' },
    { id: 'water_first', cat: 'physical', pts: 1, mode: 'repeat', text: 'Have a full glass of water before having any caffeine' },
    { id: 'sleep_8', cat: 'physical', pts: 1, mode: 'repeat', daily: true, text: 'Get at least eight hours of sleep per night' },
    // Spiritual
    { id: 'rosary', cat: 'spiritual', pts: 3, mode: 'repeat', text: 'Say the Rosary' },
    { id: 'journal', cat: 'spiritual', pts: 2, mode: 'repeat', text: 'Spend time journaling or writing prayers' },
    { id: 'mass', cat: 'spiritual', pts: 1, mode: 'repeat', maxPerMonth: 5, text: 'Go to Sunday Mass' },
    { id: 'confession', cat: 'spiritual', pts: 3, mode: 'repeat', text: 'Go to Confession' },
    { id: 'pray_colleague', cat: 'spiritual', pts: 1, mode: 'repeat', text: 'Pray for a colleague' },
    { id: 'scripture', cat: 'spiritual', pts: 2, mode: 'repeat', text: 'Read Scripture' },
    { id: 'mercy', cat: 'spiritual', pts: 5, mode: 'repeat', text: 'Perform a work of mercy' },
    { id: 'adoration', cat: 'spiritual', pts: 5, mode: 'repeat', text: 'Spend an hour in adoration' },
    // Mental / Emotional
    { id: 'therapy', cat: 'mental', pts: 3, mode: 'repeat', text: 'Go to a therapy session' },
    { id: 'meditate', cat: 'mental', pts: 2, mode: 'repeat', text: 'Meditate' },
    { id: 'meal_friend', cat: 'mental', pts: 2, mode: 'repeat', text: 'Share a meal with a friend' },
    { id: 'alone', cat: 'mental', pts: 1, mode: 'repeat', text: 'Spend time alone' },
    { id: 'nature', cat: 'mental', pts: 1, mode: 'repeat', text: 'Spend time in nature' },
    { id: 'screen_limit', cat: 'mental', pts: 1, mode: 'repeat', daily: true, text: 'Limit at-home screen time to less than one hour' },
    { id: 'phone_away', cat: 'mental', pts: 2, mode: 'repeat', daily: true, text: 'Put your phone away at least one hour before bed' },
    { id: 'walk_20', cat: 'mental', pts: 1, mode: 'repeat', text: 'Go for a 20-minute walk outside' }
  ]
};
