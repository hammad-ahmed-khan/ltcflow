// backend/src/services/outsetaApi.js
const axios = require("axios");
const Config = require("../../config");

class OutsetaApiService {
  constructor() {
    this.baseURL = Config.outseta?.apiUrl || "https://api.outseta.com/v1";
    this.apiKey = Config.outseta?.apiKey;
    this.secretKey = Config.outseta?.secretKey;

    // Create axios instance with auth
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.apiKey,
        password: this.secretKey,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Check if Outseta is configured
  isConfigured() {
    return !!(this.apiKey && this.secretKey);
  }

  // Create a person in Outseta
  async createPerson(userData, companyData) {
    if (!this.isConfigured()) {
      console.warn("Outseta not configured - skipping person creation");
      return null;
    }

    try {
      const personData = {
        Email: userData.email,
        FirstName: userData.firstName,
        LastName: userData.lastName,
        Phone: userData.phone || null,
        // Link to the account (company)
        Account: companyData.outsetaAccountId
          ? {
              Uid: companyData.outsetaAccountId,
            }
          : null,
      };

      console.log(`🔄 Creating person in Outseta: ${userData.email}`);

      const response = await this.client.post("/people", personData);

      console.log(
        `✅ Person created in Outseta: ${userData.email} [${response.data.Uid}]`
      );

      return {
        success: true,
        personId: response.data.Uid,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to create person in Outseta:",
        error.response?.data || error.message
      );

      // Don't throw error - user creation should continue even if Outseta fails
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Update a person in Outseta
  async updatePerson(outsetaPersonId, userData) {
    if (!this.isConfigured() || !outsetaPersonId) {
      console.warn(
        "Outseta not configured or no person ID - skipping person update"
      );
      return null;
    }

    try {
      const personData = {
        Email: userData.email,
        FirstName: userData.firstName,
        LastName: userData.lastName,
        Phone: userData.phone || null,
      };

      console.log(`🔄 Updating person in Outseta: ${outsetaPersonId}`);

      const response = await this.client.put(
        `/people/${outsetaPersonId}`,
        personData
      );

      console.log(`✅ Person updated in Outseta: ${outsetaPersonId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to update person in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Delete a person from Outseta
  async deletePerson(outsetaPersonId) {
    if (!this.isConfigured() || !outsetaPersonId) {
      console.warn(
        "Outseta not configured or no person ID - skipping person deletion"
      );
      return null;
    }

    try {
      console.log(`🔄 Deleting person from Outseta: ${outsetaPersonId}`);

      await this.client.delete(`/people/${outsetaPersonId}`);

      console.log(`✅ Person deleted from Outseta: ${outsetaPersonId}`);

      return {
        success: true,
        message: "Person deleted successfully",
      };
    } catch (error) {
      console.error(
        "❌ Failed to delete person from Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get person from Outseta by email
  async getPersonByEmail(email) {
    if (!this.isConfigured()) {
      console.warn("Outseta not configured - skipping person lookup");
      return null;
    }

    try {
      console.log(`🔍 Looking up person in Outseta: ${email}`);

      const response = await this.client.get(`/people`, {
        params: {
          Email: email,
        },
      });

      const people = response.data.Items || [];
      const person = people.find(
        (p) => p.Email.toLowerCase() === email.toLowerCase()
      );

      if (person) {
        console.log(`✅ Person found in Outseta: ${email} [${person.Uid}]`);
        return {
          success: true,
          person: person,
        };
      } else {
        console.log(`❌ Person not found in Outseta: ${email}`);
        return {
          success: false,
          error: "Person not found",
        };
      }
    } catch (error) {
      console.error(
        "❌ Failed to lookup person in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Add person to account (company)
  async addPersonToAccount(outsetaPersonId, outsetaAccountId) {
    if (!this.isConfigured() || !outsetaPersonId || !outsetaAccountId) {
      console.warn(
        "Outseta not configured or missing IDs - skipping person-account link"
      );
      return null;
    }

    try {
      console.log(
        `🔄 Adding person ${outsetaPersonId} to account ${outsetaAccountId} in Outseta`
      );

      // Update person to link to account
      const response = await this.client.put(`/people/${outsetaPersonId}`, {
        Account: {
          Uid: outsetaAccountId,
        },
      });

      console.log(
        `✅ Person added to account in Outseta: ${outsetaPersonId} -> ${outsetaAccountId}`
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ Failed to add person to account in Outseta:",
        error.response?.data || error.message
      );

      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new OutsetaApiService();
