export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  graphql_public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string
          name: string
          category: 'strength' | 'cardio' | 'flexibility' | 'other'
          muscle_groups: string[]
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          category: 'strength' | 'cardio' | 'flexibility' | 'other'
          muscle_groups?: string[]
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: 'strength' | 'cardio' | 'flexibility' | 'other'
          muscle_groups?: string[]
          created_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          name: string
          started_at: string
          completed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          started_at?: string
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          started_at?: string
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          id: string
          workout_id: string
          exercise_id: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_id: string
          order?: number
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          exercise_id?: string
          order?: number
          created_at?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          id: string
          workout_exercise_id: string
          set_number: number
          reps: number | null
          weight: number | null
          duration: number | null
          distance: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_exercise_id: string
          set_number: number
          reps?: number | null
          weight?: number | null
          duration?: number | null
          distance?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_exercise_id?: string
          set_number?: number
          reps?: number | null
          weight?: number | null
          duration?: number | null
          distance?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          id: string
          user_id: string
          recorded_at: string
          fat_st: number | null
          fat_lbs: number | null
          muscle_st: number | null
          muscle_lbs: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recorded_at?: string
          fat_st?: number | null
          fat_lbs?: number | null
          muscle_st?: number | null
          muscle_lbs?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recorded_at?: string
          fat_st?: number | null
          fat_lbs?: number | null
          muscle_st?: number | null
          muscle_lbs?: number | null
          created_at?: string
        }
        Relationships: []
      }
      protein_intake: {
        Row: {
          id: string
          user_id: string
          grams: number
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          grams: number
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          grams?: number
          recorded_at?: string
          created_at?: string
        }
        Relationships: []
      }
      personal_bests: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      personal_best_records: {
        Row: {
          id: string
          personal_best_id: string
          user_id: string
          sets: number
          reps: number
          weight: number
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          personal_best_id: string
          user_id: string
          sets: number
          reps: number
          weight: number
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          personal_best_id?: string
          user_id?: string
          sets?: number
          reps?: number
          weight?: number
          recorded_at?: string
          created_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          description: string
          target_date: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          target_date: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          target_date?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type WorkoutExerciseInsert = Database['public']['Tables']['workout_exercises']['Insert']
export type WorkoutSet = Database['public']['Tables']['sets']['Row']
export type WorkoutSetInsert = Database['public']['Tables']['sets']['Insert']
export type BodyMetric = Database['public']['Tables']['body_metrics']['Row']
export type BodyMetricInsert = Database['public']['Tables']['body_metrics']['Insert']
export type ProteinIntake = Database['public']['Tables']['protein_intake']['Row']
export type ProteinIntakeInsert = Database['public']['Tables']['protein_intake']['Insert']
export type PersonalBest = Database['public']['Tables']['personal_bests']['Row']
export type PersonalBestInsert = Database['public']['Tables']['personal_bests']['Insert']
export type PersonalBestRecord = Database['public']['Tables']['personal_best_records']['Row']
export type PersonalBestRecordInsert = Database['public']['Tables']['personal_best_records']['Insert']
export type Goal = Database['public']['Tables']['goals']['Row']
export type GoalInsert = Database['public']['Tables']['goals']['Insert']
