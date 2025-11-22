import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get active sessions
async function getActiveSessions() {
  try {
    const loginModule = await import('../routes/login.js');
    return loginModule.activeSessions;
  } catch (e) {
    return null;
  }
}

// Helper to make Canvas API requests
async function canvasRequest(endpoint) {
  const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
  const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;
  const CANVAS_SESSION_ID = process.env.CANVAS_SESSION_ID;

  if (!CANVAS_BASE_URL) {
    throw new Error('Canvas URL not configured');
  }

  // Check if we have a session (password-based login)
  let headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (CANVAS_SESSION_ID) {
    const sessions = await getActiveSessions();
    if (sessions) {
      const session = sessions.get(CANVAS_SESSION_ID);
      if (session && session.cookies) {
        // Use session cookies for authentication
        headers['Cookie'] = session.cookies;
        console.log('🔐 Using session-based authentication');
      } else {
        throw new Error('Session expired. Please login again.');
      }
    } else {
      throw new Error('Session not found. Please login again.');
    }
  } else if (CANVAS_ACCESS_TOKEN && !CANVAS_ACCESS_TOKEN.startsWith('session_')) {
    // Use token-based authentication
    headers['Authorization'] = `Bearer ${CANVAS_ACCESS_TOKEN}`;
  } else {
    throw new Error('Canvas credentials not configured. Please login first.');
  }

  const url = `${CANVAS_BASE_URL}${endpoint}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Fetch all Canvas data
export async function fetchCanvasData() {
  try {
    console.log('📡 Fetching Canvas data...');

    // First, try to get user info to verify token works
    try {
      const user = await canvasRequest('/api/v1/users/self');
      console.log(`👤 Logged in as: ${user.name} (${user.email || 'no email'})`);
    } catch (error) {
      console.log('⚠️  Could not fetch user info:', error.message);
    }

    // Fetch courses - ONLY student courses
    let courses = [];
    try {
      // Fetch both student and teacher courses
      const [studentCourses, teacherCourses] = await Promise.all([
        canvasRequest('/api/v1/courses?enrollment_type=student&per_page=100&include[]=enrollments').catch(() => []),
        canvasRequest('/api/v1/courses?enrollment_type=teacher&per_page=100&include[]=enrollments').catch(() => [])
      ]);
      
      // Combine and deduplicate courses by ID
      const courseMap = new Map();
      [...studentCourses, ...teacherCourses].forEach(course => {
        if (course.id && !courseMap.has(course.id)) {
          courseMap.set(course.id, course);
        } else if (course.id) {
          // Merge enrollments if course already exists
          const existing = courseMap.get(course.id);
          if (course.enrollments && existing.enrollments) {
            existing.enrollments = [...existing.enrollments, ...course.enrollments];
            courseMap.set(course.id, existing);
          }
        }
      });
      courses = Array.from(courseMap.values());
      
      console.log(`📚 Found ${courses.length} total courses (${studentCourses.length} student, ${teacherCourses.length} teacher)`);
      
      // Filter to only published/active courses
      const publishedCourses = courses.filter(course => 
        course.workflow_state === 'available' || course.workflow_state === 'active'
      );
      console.log(`✅ Filtered to ${publishedCourses.length} published courses`);
      courses = publishedCourses;
    } catch (error) {
      console.error('❌ Error fetching courses:', error.message);
      courses = [];
    }
    
    // Fetch todos
    let todos = [];
    try {
      todos = await canvasRequest('/api/v1/users/self/todo');
      console.log(`📋 Found ${todos.length} todo items`);
    } catch (error) {
      console.error('❌ Error fetching todos:', error.message);
      todos = [];
    }
    
    // Fetch announcements - try multiple approaches
    let announcements = [];
    try {
      // First, try the global announcements endpoint
      try {
        const globalAnnouncements = await canvasRequest('/api/v1/announcements?context_codes[]=course_*&per_page=100');
        announcements = globalAnnouncements || [];
        console.log(`📢 Found ${announcements.length} announcements from global endpoint`);
      } catch (e) {
        console.log('⚠️  Global announcements endpoint failed, trying course-specific ones');
      }
      
      // Also try fetching announcements for each course (as discussion topics)
      if (courses.length > 0) {
        try {
          const announcementPromises = courses.map(course => 
            canvasRequest(`/api/v1/courses/${course.id}/discussion_topics?only_announcements=true&per_page=100&include[]=attachments`)
              .catch(() => [])
          );
          
          const courseAnnouncements = await Promise.all(announcementPromises);
          const flatCourseAnnouncements = courseAnnouncements.flat();
          
          // Merge and deduplicate by ID
          const announcementMap = new Map();
          announcements.forEach(ann => {
            if (ann.id) announcementMap.set(ann.id, ann);
          });
          flatCourseAnnouncements.forEach(ann => {
            if (ann.id && !announcementMap.has(ann.id)) {
              announcementMap.set(ann.id, ann);
            }
          });
          announcements = Array.from(announcementMap.values());
          console.log(`📢 Total announcements after merging: ${announcements.length}`);
        } catch (e) {
          console.log('⚠️  Course-specific announcements failed:', e.message);
        }
      }
      
      // Fetch file details for announcements with attachments
      const announcementsWithFiles = await Promise.all(
        announcements.map(async (ann) => {
          if (ann.attachments && ann.attachments.length > 0) {
            // Attachments are already included, ensure they have authenticated URLs
            const files = await Promise.all(
              ann.attachments.map(async (att) => {
                // If URL doesn't include token, fetch authenticated URL
                let fileUrl = att.url;
                if (!fileUrl || !fileUrl.includes('access_token')) {
                  try {
                    const fileDetails = await canvasRequest(`/api/v1/files/${att.id}`).catch(() => null);
                    if (fileDetails) {
                      fileUrl = fileDetails.url || `${process.env.CANVAS_BASE_URL}/api/v1/files/${att.id}?download=1`;
                    } else {
                      fileUrl = `${process.env.CANVAS_BASE_URL}/api/v1/files/${att.id}?download=1`;
                    }
                  } catch (e) {
                    fileUrl = `${process.env.CANVAS_BASE_URL}/api/v1/files/${att.id}?download=1`;
                  }
                }
                
                return {
                  id: att.id,
                  filename: att.filename,
                  display_name: att.display_name || att.filename,
                  content_type: att.content_type,
                  size: att.size,
                  url: `/api/canvas/file/${att.id}`, // Use proxy endpoint
                  thumbnail_url: att.thumbnail_url,
                  preview_url: att.preview_url
                };
              })
            );
            return { ...ann, files };
          }
          return ann;
        })
      );
      announcements = announcementsWithFiles;
      
      console.log(`✅ Final count: ${announcements.length} announcements`);
    } catch (error) {
      console.error('❌ Error fetching announcements:', error.message);
      announcements = [];
    }
    
        // Fetch assignments, modules, syllabus, and enrollments for each course
    const courseData = await Promise.all(
      courses.map(async (course) => {
        try {
          // Check if user is teacher/instructor for this course
          const isTeacher = course.enrollments?.some(e => 
            e.type === 'TeacherEnrollment' || 
            e.type === 'TaEnrollment' || 
            e.type === 'DesignerEnrollment'
          ) || course.enrollment_type === 'teacher' || course.enrollment_type === 'ta';

          const [assignments, modules, syllabus, enrollments] = await Promise.all([
            canvasRequest(`/api/v1/courses/${course.id}/assignments?per_page=100`).catch(() => []),
            canvasRequest(`/api/v1/courses/${course.id}/modules?per_page=100`).catch(() => []),
            canvasRequest(`/api/v1/courses/${course.id}?include[]=syllabus_body`).catch(() => null),
            // Only fetch enrollments if user is a teacher
            isTeacher ? canvasRequest(`/api/v1/courses/${course.id}/enrollments?per_page=100&type[]=StudentEnrollment&include[]=user`).catch(() => []) : Promise.resolve([])
          ]);
          
          // Extract syllabus from course data
          const courseSyllabus = syllabus?.syllabus_body || null;

          // Fetch module items for each module (include file details)
          const modulesWithItems = await Promise.all(
            modules.map(async (module) => {
              try {
                const items = await canvasRequest(
                  `/api/v1/courses/${course.id}/modules/${module.id}/items?per_page=100&include[]=content_details`
                ).catch(() => []);
                
                // Process items to fetch file details for File items
                const itemsWithFiles = await Promise.all(
                  items.map(async (item) => {
                    if (item.type === 'File' && item.content_id) {
                      try {
                        // Fetch file details
                        const fileDetails = await canvasRequest(
                          `/api/v1/files/${item.content_id}`
                        ).catch(() => null);
                        
                        if (fileDetails) {
                          return {
                            ...item,
                            file: {
                              id: fileDetails.id,
                              filename: fileDetails.filename,
                              display_name: fileDetails.display_name || fileDetails.filename,
                              content_type: fileDetails.content_type,
                              size: fileDetails.size,
                              url: `/api/canvas/file/${fileDetails.id}`, // Use proxy endpoint
                              thumbnail_url: fileDetails.thumbnail_url,
                              preview_url: fileDetails.preview_url
                            }
                          };
                        }
                      } catch (e) {
                        console.error(`Error fetching file ${item.content_id}:`, e.message);
                      }
                    }
                    return item;
                  })
                );
                
                return { ...module, items: itemsWithFiles };
              } catch (error) {
                console.error(`Error fetching items for module ${module.id}:`, error.message);
                return { ...module, items: [] };
              }
            })
          );

          // Process enrollments to extract student information
          const students = enrollments
            .filter(e => e.type === 'StudentEnrollment' && e.user)
            .map(e => ({
              id: e.user.id,
              name: e.user.name,
              email: e.user.email || e.user.login_id,
              sortable_name: e.user.sortable_name,
              avatar_url: e.user.avatar_url,
              enrollment_id: e.id,
              enrollment_state: e.enrollment_state,
              last_activity_at: e.last_activity_at
            }));

          return {
            ...course,
            assignments: assignments || [],
            modules: modulesWithItems || [],
            syllabus: courseSyllabus,
            isTeacher: isTeacher,
            students: students || []
          };
        } catch (error) {
          console.error(`Error fetching data for course ${course.id}:`, error.message);
          return {
            ...course,
            assignments: [],
            modules: [],
            students: [],
            isTeacher: false
          };
        }
      })
    );

    // Get user info for display
    let user = null;
    let userRoles = [];
    try {
      user = await canvasRequest('/api/v1/users/self');
      
      // Determine user role based on course enrollments
      const teacherCourses = courseData.filter(c => c.isTeacher);
      const studentCourses = courseData.filter(c => !c.isTeacher);
      
      if (teacherCourses.length > 0) {
        userRoles.push('professor');
      }
      if (studentCourses.length > 0) {
        userRoles.push('student');
      }
      
      // If no roles detected, default based on enrollment type
      if (userRoles.length === 0) {
        const allCourses = await canvasRequest('/api/v1/courses?per_page=100').catch(() => []);
        const hasTeacherRole = allCourses.some(c => 
          c.enrollments?.some(e => 
            e.type === 'TeacherEnrollment' || 
            e.type === 'TaEnrollment'
          )
        );
        userRoles = hasTeacherRole ? ['professor'] : ['student'];
      }
    } catch (e) {
      // Ignore if user fetch fails
    }

    const data = {
      courses: courseData,
      todos: todos || [],
      announcements: announcements || [],
      user: user,
      userRoles: userRoles,
      lastSynced: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Save to cache
    const cachePath = path.join(__dirname, '../data/cache.json');
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));

    console.log(`✅ Synced ${courseData.length} courses, ${todos.length} todos, ${announcements.length} announcements`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching Canvas data:', error.message);
    throw error;
  }
}

