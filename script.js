

// Your Firebase config - Replace with your actual config
const firebaseConfig = {
    apiKey: "AIzaSyAucu5GXH6DGK27Kvcmx0be10MSqOmQszY",
    authDomain: "bsms-13dde.firebaseapp.com",
    projectId: "bsms-13dde",
    storageBucket: "bsms-13dde.firebasestorage.app",
    messagingSenderId: "833706206633",
    appId: "1:833706206633:web:d312245ad65a90430590b8",
    measurementId: "G-KCF3S1HDP4"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Utility functions
function getBDTime() {
  const now = new Date();
  const bdTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Dhaka"}));
  return bdTime;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function calculateLateness(joinTime, meetingTime) {
  const diffMs = joinTime - meetingTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes <= 0) {
    return "On time";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes late`;
  } else {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m late`;
  }
}

// Main attendance submission function
async function submitAttendance(name) {
  const loadingElement = document.getElementById('loading');
  const currentTime = getBDTime();
  const currentDate = formatDate(currentTime);
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // Check time restrictions
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const meetingStartTime = 20 * 60; // 8:00 PM in minutes
  const joinWindowStart = 19 * 60 + 55; // 7:55 PM in minutes
  const joinWindowEnd = 21 * 60; // 9:00 PM in minutes
  
  // Show loading
  loadingElement.style.display = 'block';
  
  try {
    // Check if it's outside the allowed time window
    if (currentTimeInMinutes < joinWindowStart || currentTimeInMinutes > joinWindowEnd) {
      loadingElement.style.display = 'none';
      alert('Meeting is at 8:00 PM BD time. You can join between 7:55 PM and 9:00 PM only.');
      return;
    }
    
    // Check if user already joined today
    const userRef = database.ref(`attendance/${name}/${currentDate}`);
    const snapshot = await userRef.once('value');
    
    if (snapshot.exists()) {
      loadingElement.style.display = 'none';
      alert(`${name} has already joined today at ${formatTime(new Date(snapshot.val().joinTime))}`);
      return;
    }
    
    // Create meeting time for today
    const meetingTime = new Date(currentTime);
    meetingTime.setHours(20, 0, 0, 0); // 8:00 PM BD time
    
    // Calculate lateness
    const lateness = calculateLateness(currentTime, meetingTime);
    
    // Store attendance data
    const attendanceData = {
      name: name,
      joinTime: currentTime.toISOString(),
      meetingTime: meetingTime.toISOString(),
      date: currentDate,
      lateness: lateness,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    await userRef.set(attendanceData);
    
    // Hide loading and show success
    loadingElement.style.display = 'none';
    
    // Show success message and redirect immediately
    const userConfirmed = confirm(`${name} successfully joined the meeting!\nJoin time: ${formatTime(currentTime)}\nStatus: ${lateness}\n\nClick OK to join the Google Meet now.`);
    
    // Refresh analytics
    loadAnalytics();
    
    // Redirect to Google Meet
    if (userConfirmed) {
      window.open('https://meet.google.com/zkg-ykkf-yjb', '_blank');
    } else {
      // If user cancels, still give them option to join later
      setTimeout(() => {
        const joinNow = confirm('Would you like to join the Google Meet now?');
        if (joinNow) {
          window.open('https://meet.google.com/zkg-ykkf-yjb', '_blank');
        }
      }, 2000);
    }
    
  } catch (error) {
    console.error('Error submitting attendance:', error);
    loadingElement.style.display = 'none';
    alert('Error submitting attendance. Please try again.');
  }
}

// Load analytics data - simplified for individual performance only
async function loadAnalytics() {
  const currentDate = formatDate(getBDTime());
  
  try {
    // Get all attendance data
    const attendanceRef = database.ref('attendance');
    const snapshot = await attendanceRef.once('value');
    
    if (!snapshot.exists()) {
      updateAnalyticsDisplay([], []);
      return;
    }
    
    const allData = snapshot.val();
    const todayData = [];
    const allTimeData = [];
    
    // Process data for today and all time
    Object.keys(allData).forEach(userName => {
      Object.keys(allData[userName]).forEach(date => {
        const record = allData[userName][date];
        
        // Add to all time data
        allTimeData.push(record);
        
        // Add to today's data if it's today
        if (date === currentDate) {
          todayData.push(record);
        }
      });
    });
    
    updateAnalyticsDisplay(todayData, allTimeData);
    
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// Update analytics display - simplified for individual performance only
function updateAnalyticsDisplay(todayData, allTimeData) {
  // Calculate individual stats for each person
  const individualStats = {};
  
  // Initialize stats for each team member
  ['Rafi', 'Shakib', 'Sabbir'].forEach(name => {
    individualStats[name] = {
      totalJoins: 0,
      onTimeCount: 0,
      lateCount: 0,
      averageLateness: 0,
      todayStatus: 'Not joined today',
      todayTime: null
    };
  });
  
  // Process all time data
  allTimeData.forEach(record => {
    const name = record.name;
    if (individualStats[name]) {
      individualStats[name].totalJoins++;
      
      if (record.lateness === 'On time') {
        individualStats[name].onTimeCount++;
      } else {
        individualStats[name].lateCount++;
      }
    }
  });
  
  // Process today's data
  todayData.forEach(record => {
    const name = record.name;
    if (individualStats[name]) {
      individualStats[name].todayStatus = record.lateness;
      individualStats[name].todayTime = formatTime(new Date(record.joinTime));
    }
  });
  
  // Calculate averages
  Object.keys(individualStats).forEach(name => {
    const stats = individualStats[name];
    if (stats.totalJoins > 0) {
      const onTimeRate = Math.round((stats.onTimeCount / stats.totalJoins) * 100);
      stats.averageLateness = `${onTimeRate}% on time`;
    } else {
      stats.averageLateness = 'No data';
    }
  });
  
  // Update overall attendance (simple average of all team members)
  const totalOnTime = Object.values(individualStats).reduce((sum, stats) => sum + stats.onTimeCount, 0);
  const totalJoins = Object.values(individualStats).reduce((sum, stats) => sum + stats.totalJoins, 0);
  const overallRate = totalJoins > 0 ? Math.round((totalOnTime / totalJoins) * 100) : 0;
  
  document.getElementById('overallAttendance').textContent = `${overallRate}%`;
  document.getElementById('attendanceProgress').style.width = `${overallRate}%`;
  document.getElementById('attendanceDetail').textContent = `${totalJoins} total joins recorded`;
  
  // Update individual stats display
  const individualStatsElement = document.getElementById('individualStats');
  
  const statsHTML = Object.keys(individualStats).map(name => {
    const stats = individualStats[name];
    return `
      <div class="person-stat">
        <div class="person-info">
          <div class="person-name">${name}</div>
          <div class="person-overall">Overall: ${stats.averageLateness}</div>
        </div>
        <div class="person-today">
          <div class="person-time">${stats.todayTime ? `Today: ${stats.todayTime}` : 'Not joined today'}</div>
          <div class="person-status ${stats.todayStatus === 'On time' ? 'on-time' : stats.todayStatus === 'Not joined today' ? 'not-joined' : 'late'}">${stats.todayStatus}</div>
        </div>
      </div>
    `;
  }).join('');
  
  individualStatsElement.innerHTML = statsHTML;
  
  // Update last updated time
  document.getElementById('lastUpdated').textContent = `Last updated: ${formatTime(getBDTime())}`;
}

// Initialize analytics on page load
document.addEventListener('DOMContentLoaded', function() {
  loadAnalytics();
  
  // Set up real-time updates
  const attendanceRef = database.ref('attendance');
  attendanceRef.on('value', (snapshot) => {
    loadAnalytics();
  });
  
  // Auto-refresh every minute
  setInterval(loadAnalytics, 60000);
});

// Make function globally available
window.submitAttendance = submitAttendance;
