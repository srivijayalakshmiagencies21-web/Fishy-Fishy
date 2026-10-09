export type AppRole = "admin" | "manager" | "employee";
export type VendorType = "Supplier" | "Transporter";

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_modes: {
        Row: {
          id: number;
          mode: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          mode: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          mode?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      districts: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      societies: {
        Row: {
          id: number;
          district_id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          district_id: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          district_id?: number;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "societies_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          id: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      district_companies: {
        Row: {
          district_id: number;
          company_id: number;
          created_at: string;
        };
        Insert: {
          district_id: number;
          company_id: number;
          created_at?: string;
        };
        Update: {
          district_id?: number;
          company_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "district_companies_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "district_companies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          id: number;
          name: string;
          contact_number: string;
          vendor_type: VendorType;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          contact_number: string;
          vendor_type: VendorType;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          contact_number?: string;
          vendor_type?: VendorType;
          created_at?: string;
        };
        Relationships: [];
      };
      fishes: {
        Row: {
          id: number;
          fish_type: string;
          seed_size: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          fish_type: string;
          seed_size: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          fish_type?: string;
          seed_size?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      transaction_categories: {
        Row: {
          id: number;
          name: string;
          transaction_type: string;
          cost_nature: string;
          default_allocation: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          transaction_type?: string;
          cost_nature?: string;
          default_allocation?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          transaction_type?: string;
          cost_nature?: string;
          default_allocation?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: number;
          txn_date: string;
          type: string;
          account_id: number;
          to_account_id: number | null;
          amount: number;
          category: string;
          payment_mode: string;
          party: string;
          remarks: string;
          journey_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          txn_date?: string;
          type: string;
          account_id: number;
          to_account_id?: number | null;
          amount: number;
          category?: string;
          payment_mode?: string;
          party?: string;
          remarks?: string;
          journey_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          txn_date?: string;
          type?: string;
          account_id?: number;
          to_account_id?: number | null;
          amount?: number;
          category?: string;
          payment_mode?: string;
          party?: string;
          remarks?: string;
          journey_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey";
            columns: ["to_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_journey_id_fkey";
            columns: ["journey_id"];
            isOneToOne: false;
            referencedRelation: "journeys";
            referencedColumns: ["id"];
          },
        ];
      };
      journeys: {
        Row: {
          id: string;
          short_id: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          transporter_id: number;
          vehicle_number: string;
          driver_name: string;
          driver_phone: string;
          odometer_reading: number;
          odometer_image_path: string | null;
          location_name: string;
          district_id: number;
          phase: string;
          end_type: string;
          created_at: string;
          transfer_at: string | null;
          final_at: string | null;
        };
        Insert: {
          id?: string;
          short_id?: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          transporter_id: number;
          vehicle_number: string;
          driver_name: string;
          driver_phone: string;
          odometer_reading: number;
          odometer_image_path?: string | null;
          location_name: string;
          district_id: number;
          phase?: string;
          end_type?: string;
          created_at?: string;
          transfer_at?: string | null;
          final_at?: string | null;
        };
        Update: {
          id?: string;
          short_id?: string;
          supplier_id?: number;
          fish_id?: number;
          quantity?: number;
          transporter_id?: number;
          vehicle_number?: string;
          driver_name?: string;
          driver_phone?: string;
          odometer_reading?: number;
          odometer_image_path?: string | null;
          location_name?: string;
          district_id?: number;
          phase?: string;
          end_type?: string;
          created_at?: string;
          transfer_at?: string | null;
          final_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "journeys_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journeys_transporter_id_fkey";
            columns: ["transporter_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journeys_fish_id_fkey";
            columns: ["fish_id"];
            isOneToOne: false;
            referencedRelation: "fishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journeys_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          }
        ];
      };
      journey_trucks: {
        Row: {
          id: string;
          journey_id: string;
          primary_truck_id: string | null;
          transporter_id: number;
          vehicle_number: string;
          driver_name: string;
          driver_phone: string;
          odometer_reading: number;
          odometer_image_path: string | null;
          start_odometer_reading: number | null;
          start_odometer_image_path: string | null;
          transfer_odometer_reading: number | null;
          transfer_odometer_image_path: string | null;
          final_odometer_reading: number | null;
          final_odometer_image_path: string | null;
          location_name: string;
          district_id: number | null;
          end_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          journey_id: string;
          primary_truck_id?: string | null;
          transporter_id: number;
          vehicle_number: string;
          driver_name: string;
          driver_phone: string;
          odometer_reading: number;
          odometer_image_path?: string | null;
          start_odometer_reading?: number | null;
          start_odometer_image_path?: string | null;
          transfer_odometer_reading?: number | null;
          transfer_odometer_image_path?: string | null;
          final_odometer_reading?: number | null;
          final_odometer_image_path?: string | null;
          location_name?: string;
          district_id?: number | null;
          end_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          journey_id?: string;
          primary_truck_id?: string | null;
          transporter_id?: number;
          vehicle_number?: string;
          driver_name?: string;
          driver_phone?: string;
          odometer_reading?: number;
          odometer_image_path?: string | null;
          start_odometer_reading?: number | null;
          start_odometer_image_path?: string | null;
          transfer_odometer_reading?: number | null;
          transfer_odometer_image_path?: string | null;
          final_odometer_reading?: number | null;
          final_odometer_image_path?: string | null;
          location_name?: string;
          district_id?: number | null;
          end_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      truck_items: {
        Row: {
          id: string;
          truck_id: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          truck_id: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          truck_id?: string;
          supplier_id?: number;
          fish_id?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      truck_unload_drops: {
        Row: {
          id: string;
          truck_id: string;
          society_id: number;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          truck_id: string;
          society_id: number;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          truck_id?: string;
          society_id?: number;
          supplier_id?: number;
          fish_id?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      start_truck_items: {
        Row: {
          id: string;
          truck_id: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          truck_id: string;
          supplier_id: number;
          fish_id: number;
          quantity: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          truck_id?: string;
          supplier_id?: number;
          fish_id?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          allowed_pages: string[];
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          allowed_pages?: string[];
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          allowed_pages?: string[];
          is_system?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_pages: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      list_app_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          user_id: string;
          email: string | null;
          role_id: string | null;
          role_name: string | null;
          created_at: string;
          last_sign_in_at: string | null;
          active: boolean;
        }[];
      };
      create_role: {
        Args: { p_name: string; p_allowed_pages: string[] };
        Returns: string;
      };
      update_role: {
        Args: { p_role_id: string; p_name: string; p_allowed_pages: string[] };
        Returns: undefined;
      };
      delete_role: {
        Args: { p_role_id: string };
        Returns: undefined;
      };
      assign_user_role: {
        Args: { p_user_id: string; p_role_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
