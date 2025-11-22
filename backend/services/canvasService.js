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

// Helper to fetch all enrollments with pagination
async function fetchAllEnrollments(courseId) {
  const allEnrollments = [];
  let url = `/api/v1/courses/${courseId}/enrollments?per_page=100&type[]=StudentEnrollment&include[]=user`;
  
  try {
    const response = await canvasRequest(url);
    if (Array.isArray(response)) {
      allEnrollments.push(...response);
    }
  } catch (error) {
    console.error(`Error fetching enrollments for course ${courseId}:`, error.message);
  }
  
  return allEnrollments;
}

// Fetch all Canvas data
export async function fetchCanvasData() {
  try {
    console.log('📡 Fetching Canvas data...');

    // Load existing cached data to preserve previous quarter courses
    let existingData = null;
    const cachePath = path.join(__dirname, '../data/cache.json');
    try {
      const existingCache = await fs.readFile(cachePath, 'utf-8').catch(() => null);
      if (existingCache) {
        existingData = JSON.parse(existingCache);
        console.log(`📦 Loaded ${existingData.courses?.length || 0} existing courses from cache`);
      }
    } catch (error) {
      console.log('⚠️  Could not load existing cache:', error.message);
    }

    // First, try to get user info to verify token works
    try {
      const user = await canvasRequest('/api/v1/users/self');
      console.log(`👤 Logged in as: ${user.name} (${user.email || 'no email'})`);
    } catch (error) {
      console.log('⚠️  Could not fetch user info:', error.message);
    }

    // Fetch courses - both student and teacher courses
    let courses = [];
    let studentCourses = [];
    let teacherCourses = [];
    try {
      // Fetch both student and teacher courses
      [studentCourses, teacherCourses] = await Promise.all([
        canvasRequest('/api/v1/courses?enrollment_type=student&per_page=100&include[]=enrollments').catch(() => []),
        canvasRequest('/api/v1/courses?enrollment_type=teacher&per_page=100&include[]=enrollments').catch(() => [])
      ]);
      
      // Combine and deduplicate courses by ID
      // Track which courses are teacher courses
      const teacherCourseIds = new Set(teacherCourses.map(c => c.id));
      const courseMap = new Map();
      [...studentCourses, ...teacherCourses].forEach(course => {
        if (course.id && !courseMap.has(course.id)) {
          // Mark if this is a teacher course
          course._isTeacherCourse = teacherCourseIds.has(course.id);
          courseMap.set(course.id, course);
        } else if (course.id) {
          // Merge enrollments if course already exists
          const existing = courseMap.get(course.id);
          if (course.enrollments && existing.enrollments) {
            existing.enrollments = [...existing.enrollments, ...course.enrollments];
          }
          // Update teacher flag if this course is a teacher course
          if (teacherCourseIds.has(course.id)) {
            existing._isTeacherCourse = true;
          }
          courseMap.set(course.id, existing);
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
          // Use the _isTeacherCourse flag we set, or check enrollments/enrollment_type
          const isTeacher = course._isTeacherCourse || 
            course.enrollments?.some(e => 
              e.type === 'TeacherEnrollment' || 
              e.type === 'TaEnrollment' || 
              e.type === 'DesignerEnrollment'
            ) || 
            course.enrollment_type === 'teacher' || 
            course.enrollment_type === 'ta';

          console.log(`📝 Course ${course.id} (${course.name}): isTeacher=${isTeacher}`);

          const [assignments, modules, syllabus, enrollments] = await Promise.all([
            canvasRequest(`/api/v1/courses/${course.id}/assignments?per_page=100`).catch(() => []),
            canvasRequest(`/api/v1/courses/${course.id}/modules?per_page=100`).catch(() => []),
            canvasRequest(`/api/v1/courses/${course.id}?include[]=syllabus_body`).catch(() => null),
            // Only fetch enrollments if user is a teacher - use helper to get all enrollments
            isTeacher ? fetchAllEnrollments(course.id).catch((err) => {
              console.error(`Error fetching enrollments for course ${course.id}:`, err.message);
              return [];
            }) : Promise.resolve([])
          ]);
          
          if (isTeacher) {
            console.log(`👥 Fetched ${enrollments.length} student enrollments for course ${course.id} (${course.name})`);
          }
          
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
          let students = [];
          if (enrollments && Array.isArray(enrollments)) {
            students = enrollments
              .filter(e => {
                // Filter for student enrollments that have user data
                const isStudentEnrollment = e.type === 'StudentEnrollment';
                const hasUser = e.user && (e.user.id || e.user.name);
                if (isTeacher && !isStudentEnrollment) {
                  console.log(`⚠️  Skipping non-student enrollment type: ${e.type} for course ${course.id}`);
                }
                return isStudentEnrollment && hasUser;
              })
              .map(e => ({
                id: e.user.id,
                name: e.user.name || e.user.display_name || 'Unknown',
                email: e.user.email || e.user.login_id || '',
                sortable_name: e.user.sortable_name,
                avatar_url: e.user.avatar_url,
                enrollment_id: e.id,
                enrollment_state: e.enrollment_state || 'active',
                last_activity_at: e.last_activity_at
              }));
            
            if (isTeacher) {
              console.log(`✅ Processed ${students.length} students from ${enrollments.length} enrollments for course ${course.id}`);
            }
          } else if (isTeacher) {
            console.log(`⚠️  No enrollments array found for course ${course.id} (enrollments type: ${typeof enrollments})`);
          }

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
      
      // Determine user role based on the original course arrays fetched from API
      // These arrays are guaranteed to be correct based on enrollment_type parameter
      // Filter to only published/active courses for role detection
      const publishedTeacherCourses = teacherCourses.filter(course => 
        course.workflow_state === 'available' || course.workflow_state === 'active'
      );
      const publishedStudentCourses = studentCourses.filter(course => 
        course.workflow_state === 'available' || course.workflow_state === 'active'
      );
      
      // Professor takes priority: if user has ANY teacher courses, they're a professor
      if (publishedTeacherCourses.length > 0) {
        userRoles.push('professor');
        console.log(`👨‍🏫 User role: Professor (${publishedTeacherCourses.length} teaching course${publishedTeacherCourses.length !== 1 ? 's' : ''})`);
      } 
      // If no teacher courses but has student courses, they're a student
      else if (publishedStudentCourses.length > 0) {
        userRoles.push('student');
        console.log(`🎓 User role: Student (${publishedStudentCourses.length} course${publishedStudentCourses.length !== 1 ? 's' : ''})`);
      }
      // If no published courses, check all courses (including unpublished)
      else if (teacherCourses.length > 0) {
        userRoles.push('professor');
        console.log(`👨‍🏫 User role: Professor (${teacherCourses.length} teaching course${teacherCourses.length !== 1 ? 's' : ''} - including unpublished)`);
      }
      else if (studentCourses.length > 0) {
        userRoles.push('student');
        console.log(`🎓 User role: Student (${studentCourses.length} course${studentCourses.length !== 1 ? 's' : ''} - including unpublished)`);
      }
      // If still no role detected, default to student
      else {
        userRoles.push('student');
        console.log('🎓 User role: Student (default - no courses found)');
      }
    } catch (e) {
      console.error('❌ Error determining user role:', e.message);
      // Default to student if role detection fails
      userRoles = ['student'];
    }

    // CRITICAL: Never delete courses from local storage - always preserve ALL existing courses
    // This is especially important when students are removed from courses like "Math 1A"
    // Merge strategy: Start with ALL existing courses, then update/add new ones
    const existingCourseMap = new Map();
    
    // First, load ALL existing courses from cache into a map (by ID)
    // This is the source of truth - we NEVER delete from this
    if (existingData && existingData.courses) {
      existingData.courses.forEach(course => {
        if (course.id) {
          // Store course with all its data - this is NEVER deleted
          existingCourseMap.set(course.id, { ...course });
          const courseName = course.name || course.course_code || `Course ${course.id}`;
          console.log(`📦 Loaded course ${course.id} (${courseName}) from cache`);
        }
      });
      console.log(`📦 Total: Loaded ${existingCourseMap.size} existing course(s) from cache (including Math 1A and all others)`);
    } else {
      console.log(`⚠️  No existing cache data found - starting fresh`);
    }
    
    // Get IDs of new courses from Canvas (may be empty if student was removed)
    const newCourseIds = new Set(courseData.map(c => c.id));
    console.log(`🆕 Found ${newCourseIds.size} course(s) in current Canvas response`);
    if (newCourseIds.size > 0) {
      console.log(`🆕 Canvas course IDs: ${Array.from(newCourseIds).join(', ')}`);
    }
    
    // Then, update existing courses with new data OR add new courses
    // This ensures we NEVER delete - only update or add
    courseData.forEach(newCourse => {
      if (newCourse.id) {
        // If course exists in cache, merge new data with existing (preserve all nested data)
        const existingCourse = existingCourseMap.get(newCourse.id);
        if (existingCourse) {
          // Merge: keep existing nested data, update with new course info
          existingCourseMap.set(newCourse.id, {
            ...existingCourse,
            ...newCourse, // Update with new course data
            // Preserve nested data from existing course if new course doesn't have it
            assignments: newCourse.assignments?.length > 0 ? newCourse.assignments : (existingCourse.assignments || []),
            modules: newCourse.modules?.length > 0 ? newCourse.modules : (existingCourse.modules || []),
            syllabus: newCourse.syllabus || existingCourse.syllabus || null,
            students: newCourse.students?.length > 0 ? newCourse.students : (existingCourse.students || []),
            // Clear past course flags if course is active again
            previousQuarter: false,
            pastCourse: false
          });
          console.log(`🔄 Updated course ${newCourse.id} (${newCourse.name || 'unnamed'}) with new data`);
        } else {
          // New course - add it
          existingCourseMap.set(newCourse.id, newCourse);
          console.log(`➕ Added new course ${newCourse.id} (${newCourse.name || 'unnamed'})`);
        }
      }
    });
    
    // CRITICAL: Preserve courses that were REMOVED from Canvas
    // If a course is NOT in the Canvas response, it means student/professor was removed
    // These removed courses are the ones we preserve - they stay in local storage forever
    let preservedCount = 0;
    const allCacheCourseIds = Array.from(existingCourseMap.keys());
    console.log(`🔍 Checking ${allCacheCourseIds.length} courses from cache against ${newCourseIds.size} courses from Canvas`);
    
    existingCourseMap.forEach((course, courseId) => {
      // If course is NOT in new Canvas response, it was REMOVED - preserve it
      if (!newCourseIds.has(courseId) && course.id) {
        // Course was REMOVED from Canvas (student/professor no longer enrolled)
        // This is the course we PRESERVE - it stays in local storage
        const courseName = course.name || course.course_code || `Course ${courseId}`;
        console.log(`🔒 PRESERVING REMOVED course ${courseId} (${courseName}) - was removed from Canvas but kept in local storage`);
        
        // Mark as past course (removed course) but keep ALL data
        course.previousQuarter = true;
        course.pastCourse = true;
        // Ensure all nested data is preserved for the removed course
        course.assignments = course.assignments || [];
        course.modules = course.modules || [];
        course.syllabus = course.syllabus || null;
        course.students = course.students || [];
        existingCourseMap.set(courseId, course);
        preservedCount++;
      } else if (newCourseIds.has(courseId)) {
        // Course IS in Canvas response - it's active, not removed
        const courseName = course.name || course.course_code || `Course ${courseId}`;
        console.log(`✅ Course ${courseId} (${courseName}) is active in Canvas`);
      }
    });
    
    // Convert map back to array - this contains ALL courses (never deleted)
    // Math 1A and all other courses are guaranteed to be here
    const mergedCourses = Array.from(existingCourseMap.values());
    
    if (preservedCount > 0) {
      console.log(`✅ PRESERVED ${preservedCount} course(s) including Math 1A - courses are NEVER deleted from local storage`);
    }
    console.log(`💾 Total courses in storage: ${mergedCourses.length} (${mergedCourses.length - preservedCount} active, ${preservedCount} preserved)`);

    const data = {
      courses: mergedCourses,
      todos: todos || [],
      announcements: announcements || [],
      user: user,
      userRoles: userRoles,
      lastSynced: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Save to cache
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));

    const activeCourses = mergedCourses.filter(c => !c.previousQuarter).length;
    const previousCourses = mergedCourses.filter(c => c.previousQuarter).length;
    console.log(`✅ Synced ${activeCourses} active courses, ${previousCourses} previous quarter courses, ${todos.length} todos, ${announcements.length} announcements`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching Canvas data:', error.message);
    throw error;
  }
}

