"use client"

interface OfflineAttendance {
  id: string
  studentId: string
  studentName: string
  timestamp: string
  synced: boolean
}

interface OfflineStudent {
  id: string
  name: string
  email: string
  department: string
  year: string
}

class OfflineStorageManager {
  private dbName = "ieee-attendance-db"
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create attendance store
        if (!db.objectStoreNames.contains("attendance")) {
          const attendanceStore = db.createObjectStore("attendance", { keyPath: "id" })
          attendanceStore.createIndex("synced", "synced", { unique: false })
          attendanceStore.createIndex("timestamp", "timestamp", { unique: false })
        }

        // Create students store
        if (!db.objectStoreNames.contains("students")) {
          const studentsStore = db.createObjectStore("students", { keyPath: "id" })
          studentsStore.createIndex("name", "name", { unique: false })
        }
      }
    })
  }

  async storeAttendance(attendance: Omit<OfflineAttendance, "id" | "synced">): Promise<string> {
    if (!this.db) await this.init()

    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const record: OfflineAttendance = {
      ...attendance,
      id,
      synced: false,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["attendance"], "readwrite")
      const store = transaction.objectStore("attendance")
      const request = store.add(record)

      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedAttendance(): Promise<OfflineAttendance[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["attendance"], "readonly");
      const store = transaction.objectStore("attendance");
      const index = store.index("synced");
      const results: OfflineAttendance[] = [];
      const request = index.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (cursor.value.synced === false) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAttendanceSynced(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["attendance"], "readwrite")
      const store = transaction.objectStore("attendance")
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const record = getRequest.result
        if (record) {
          record.synced = true
          const putRequest = store.put(record)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async storeStudents(students: OfflineStudent[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["students"], "readwrite")
      const store = transaction.objectStore("students")

      // Clear existing students
      store.clear()

      // Add new students
      students.forEach((student) => {
        store.add(student)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getStudents(): Promise<OfflineStudent[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["students"], "readonly")
      const store = transaction.objectStore("students")
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async findStudent(studentId: string): Promise<OfflineStudent | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["students"], "readonly")
      const store = transaction.objectStore("students")
      const request = store.get(studentId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
}

export const offlineStorage = new OfflineStorageManager()
