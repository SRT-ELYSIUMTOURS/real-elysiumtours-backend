"use strict";

module.exports = {
  CUSTOMER: {
    name: "customer",
    description: "End user who browses and books tours",
    isDefault: true,
  },
  STAFF: {
    name: "staff",
    description: "Internal staff who manages pricing desk and operations",
    isDefault: false,
  },
  ADMIN: {
    name: "admin",
    description: "Full platform access — manages all resources, settings, and staff",
    isDefault: false,
  },
};
