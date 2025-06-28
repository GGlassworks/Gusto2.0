// /lib/crm/advancedPipedriveService.js
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class AdvancedPipedriveService {
  constructor() {
    this.baseUrl = 'https://api.pipedrive.com/v1'
    this.apiKey = process.env.PIPEDRIVE_API_KEY
    
    // Custom field IDs from your Pipedrive setup
    this.customFields = {
      warrantyExpiry: '12345_warranty_expiry',
      installDate: '12346_install_date',
      glassType: '12347_glass_type',
      sqFootage: '12348_sq_footage',
      lastServiceDate: '12349_last_service',
      customerSegment: '12350_segment',
      lifetimeValue: '12351_ltv',
      preferredContact: '12352_contact_method',
      propertyType: '12353_property_type',
      urgencyLevel: '12354_urgency'
    }
    
    // Pipeline stages for different workflows
    this.pipelines = {
      sales: {
        id: 1,
        stages: {
          newLead: 1,
          qualified: 2,
          siteVisit: 3,
          quoteProvided: 4,
          negotiation: 5,
          closed: 6
        }
      },
      warranty: {
        id: 2,
        stages: {
          claimReceived: 7,
          inspection: 8,
          approved: 9,
          inProgress: 10,
          resolved: 11
        }
      },
      service: {
        id: 3,
        stages: {
          scheduled: 12,
          inProgress: 13,
          completed: 14,
          followUp: 15
        }
      }
    }
  }

  // Advanced customer identification with fuzzy matching
  async identifyCustomer(identifiers) {
    const { phone, email, firstName, lastName, address } = identifiers
    
    try {
      // First try exact match
      let persons = await this.searchPersons({
        term: phone || email,
        exact_match: true
      })
      
      if (!persons.length && (firstName || lastName)) {
        // Try name search with fuzzy matching
        const searchTerm = `${firstName || ''} ${lastName || ''}`.trim()
        persons = await this.searchPersons({ term: searchTerm })
        
        // Score matches based on similarity
        persons = persons.map(person => ({
          ...person,
          matchScore: this.calculateMatchScore(person, identifiers)
        })).filter(p => p.matchScore > 0.7)
        .sort((a, b) => b.matchScore - a.matchScore)
      }
      
      if (persons.length > 0) {
        const customer = persons[0]
        
        // Get full customer profile with all deals and activities
        const profile = await this.getCustomerProfile(customer.id)
        
        // Determine customer segment
        profile.segment = await this.calculateCustomerSegment(profile)
        
        // Check warranty status
        profile.warrantyStatus = await this.checkWarrantyStatus(profile)
        
        return {
          found: true,
          customer: profile,
          confidence: persons[0].matchScore || 1.0,
          duplicates: persons.slice(1) // Other potential matches
        }
      }
      
      return { found: false, identifiers }
      
    } catch (error) {
      console.error('Customer identification error:', error)
      throw error
    }
  }

  // Calculate similarity score for fuzzy matching
  calculateMatchScore(person, identifiers) {
    let score = 0
    let factors = 0
    
    // Phone match (highest weight)
    if (identifiers.phone && person.phone) {
      const cleanPhone1 = identifiers.phone.replace(/\D/g, '')
      const cleanPhone2 = person.phone[0]?.value.replace(/\D/g, '')
      if (cleanPhone1 === cleanPhone2) {
        score += 0.4
      }
      factors += 0.4
    }
    
    // Email match
    if (identifiers.email && person.email) {
      if (identifiers.email.toLowerCase() === person.email[0]?.value.toLowerCase()) {
        score += 0.3
      }
      factors += 0.3
    }
    
    // Name similarity
    if (identifiers.firstName || identifiers.lastName) {
      const nameScore = this.calculateNameSimilarity(
        `${identifiers.firstName || ''} ${identifiers.lastName || ''}`,
        person.name
      )
      score += nameScore * 0.3
      factors += 0.3
    }
    
    return factors > 0 ? score / factors : 0
  }

  // Advanced customer profile with full history
  async getCustomerProfile(personId) {
    const [person, deals, activities, notes] = await Promise.all([
      this.getPerson(personId),
      this.getPersonDeals(personId),
      this.getPersonActivities(personId),
      this.getPersonNotes(personId)
    ])
    
    // Calculate metrics
    const metrics = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
      avgDealSize: deals.length ? this.totalValue / deals.length : 0,
      winRate: deals.length ? deals.filter(d => d.status === 'won').length / deals.length : 0,
      lastInteraction: this.getLastInteractionDate(activities),
      activeWarranties: deals.filter(d => d.customFields?.warrantyExpiry > new Date()).length
    }
    
    // Get conversation history from our database
    const conversations = await prisma.conversation.findMany({
      where: {
        customer: {
          pipedriveId: personId.toString()
        }
      },
      include: {
        messages: true
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 10
    })
    
    return {
      ...person,
      deals,
      activities,
      notes,
      metrics,
      conversations,
      customFields: this.extractCustomFields(person)
    }
  }

  // Intelligent deal creation with auto-routing
  async createSmartDeal(data) {
    const {
      customer,
      serviceType,
      urgency,
      description,
      estimatedValue,
      propertyInfo,
      conversationId
    } = data
    
    try {
      // Determine pipeline and stage based on context
      const routing = this.determineRouting(serviceType, urgency, customer)
      
      // Calculate deal value if not provided
      const dealValue = estimatedValue || await this.estimateDealValue(serviceType, propertyInfo)
      
      // Create the deal
      const deal = await this.createDeal({
        title: this.generateDealTitle(customer, serviceType),
        person_id: customer.id,
        pipeline_id: routing.pipelineId,
        stage_id: routing.stageId,
        value: dealValue,
        currency: 'USD',
        expected_close_date: this.calculateExpectedCloseDate(urgency),
        visible_to: '3', // Entire company
        customFields: {
          [this.customFields.glassType]: serviceType,
          [this.customFields.urgencyLevel]: urgency,
          [this.customFields.propertyType]: propertyInfo?.type,
          [this.customFields.sqFootage]: propertyInfo?.sqFootage
        }
      })
      
      // Add detailed note with conversation summary
      if (conversationId) {
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { messages: true }
        })
        
        const note = await this.createConversationNote(deal.id, conversation)
      }
      
      // Create follow-up activity
      await this.createSmartActivity(deal.id, customer.id, routing.nextAction)
      
      // Update customer segment if needed
      await this.updateCustomerSegment(customer.id, deal)
      
      // Trigger automation webhooks
      await this.triggerAutomation('deal_created', {
        dealId: deal.id,
        routing,
        customer
      })
      
      return {
        deal,
        routing,
        automationTriggered: true
      }
      
    } catch (error) {
      console.error('Smart deal creation error:', error)
      throw error
    }
  }

  // Determine optimal pipeline routing
  determineRouting(serviceType, urgency, customer) {
    // Check if this is a warranty claim
    if (serviceType.toLowerCase().includes('warranty') || 
        serviceType.toLowerCase().includes('repair')) {
      return {
        pipelineId: this.pipelines.warranty.id,
        stageId: this.pipelines.warranty.stages.claimReceived,
        assignedTo: this.getWarrantySpecialist(),
        nextAction: {
          type: 'warranty_inspection',
          dueIn: urgency === 'high' ? 24 : 72 // hours
        }
      }
    }
    
    // Service request for existing customer
    if (customer.metrics?.totalDeals > 0) {
      return {
        pipelineId: this.pipelines.service.id,
        stageId: this.pipelines.service.stages.scheduled,
        assignedTo: this.getServiceTechnician(customer.preferredTech),
        nextAction: {
          type: 'service_call',
          dueIn: urgency === 'high' ? 48 : 120 // hours
        }
      }
    }
    
    // New sales opportunity
    return {
      pipelineId: this.pipelines.sales.id,
      stageId: this.pipelines.sales.stages.newLead,
      assignedTo: this.getSalesRep(customer.location),
      nextAction: {
        type: 'initial_contact',
        dueIn: urgency === 'high' ? 2 : 24 // hours
      }
    }
  }

  // Warranty management system
  async checkWarrantyStatus(customer) {
    const warranties = []
    
    for (const deal of customer.deals) {
      if (deal.status === 'won' && deal.customFields?.installDate) {
        const installDate = new Date(deal.customFields.installDate)
        const warrantyYears = this.getWarrantyPeriod(deal.customFields.glassType)
        const expiryDate = new Date(installDate)
        expiryDate.setFullYear(expiryDate.getFullYear() + warrantyYears)
        
        const status = {
          dealId: deal.id,
          product: deal.customFields.glassType,
          installDate,
          expiryDate,
          isActive: expiryDate > new Date(),
          daysRemaining: Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24)),
          claims: await this.getWarrantyClaims(deal.id)
        }
        
        warranties.push(status)
      }
    }
    
    return {
      activeWarranties: warranties.filter(w => w.isActive),
      expiredWarranties: warranties.filter(w => !w.isActive),
      totalClaims: warranties.reduce((sum, w) => sum + w.claims.length, 0)
    }
  }

  // Smart activity creation with context
  async createSmartActivity(dealId, personId, action) {
    const activityTypes = {
      initial_contact: {
        type: 'call',
        subject: '🎯 Initial Contact - New Lead',
        note: 'Contact customer to understand their needs and schedule site visit'
      },
      warranty_inspection: {
        type: 'meeting',
        subject: '🔍 Warranty Inspection Required',
        note: 'Inspect reported issue and document findings for warranty claim'
      },
      service_call: {
        type: 'task',
        subject: '🔧 Service Call Scheduled',
        note: 'Perform requested service and ensure customer satisfaction'
      },
      follow_up: {
        type: 'call',
        subject: '📞 Follow-up Call',
        note: 'Check customer satisfaction and identify any additional needs'
      }
    }
    
    const activityConfig = activityTypes[action.type] || activityTypes.follow_up
    const dueDate = new Date()
    dueDate.setHours(dueDate.getHours() + action.dueIn)
    
    return await this.createActivity({
      type: activityConfig.type,
      subject: activityConfig.subject,
      note: activityConfig.note,
      due_date: dueDate.toISOString().split('T')[0],
      due_time: dueDate.toTimeString().split(' ')[0],
      duration: '00:30',
      deal_id: dealId,
      person_id: personId,
      assigned_to_user_id: action.assignedTo || null
    })
  }

  // Customer segment calculation
  async calculateCustomerSegment(customer) {
    const { metrics } = customer
    
    // Define segment criteria
    if (metrics.totalValue > 50000 || metrics.totalDeals > 5) {
      return 'VIP'
    } else if (metrics.totalValue > 20000 || metrics.totalDeals > 2) {
      return 'Premium'
    } else if (metrics.totalDeals > 0) {
      return 'Standard'
    } else {
      return 'New'
    }
  }

  // Estimate deal value based on service type and property info
  async estimateDealValue(serviceType, propertyInfo) {
    const baseRates = {
      'residential_window': 500,
      'commercial_window': 1500,
      'shower_door': 800,
      'mirror': 300,
      'storefront': 5000,
      'curtain_wall': 10000,
      'repair': 200,
      'emergency': 500
    }
    
    let baseValue = 1000 // default
    
    // Find matching rate
    for (const [key, value] of Object.entries(baseRates)) {
      if (serviceType.toLowerCase().includes(key)) {
        baseValue = value
        break
      }
    }
    
    // Adjust for square footage if provided
    if (propertyInfo?.sqFootage) {
      const multiplier = Math.max(1, propertyInfo.sqFootage / 100)
      baseValue *= multiplier
    }
    
    // Add urgency premium
    if (propertyInfo?.urgency === 'high') {
      baseValue *= 1.25
    }
    
    return Math.round(baseValue)
  }

  // Create comprehensive conversation note
  async createConversationNote(dealId, conversation) {
    const summary = await this.summarizeConversation(conversation)
    
    const noteContent = `
🤖 AI CONVERSATION SUMMARY
========================

Date: ${conversation.startedAt.toLocaleString()}
Channel: ${conversation.channel}
Duration: ${Math.round((conversation.endedAt - conversation.startedAt) / 60000)} minutes
Language: ${conversation.language}

CUSTOMER INTENT
--------------
${summary.intent}

KEY POINTS DISCUSSED
-------------------
${summary.keyPoints.map(point => `• ${point}`).join('\n')}

CUSTOMER REQUIREMENTS
--------------------
${summary.requirements.map(req => `✓ ${req}`).join('\n')}

ACTION ITEMS
-----------
${summary.actionItems.map(item => `→ ${item}`).join('\n')}

SENTIMENT ANALYSIS
-----------------
Overall: ${summary.sentiment} (${summary.sentimentScore}/5)
${summary.concerns.length > 0 ? `\nConcerns:\n${summary.concerns.map(c => `⚠️ ${c}`).join('\n')}` : ''}

FULL TRANSCRIPT
--------------
${conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}
    `
    
    return await this.createNote({
      content: noteContent,
      deal_id: dealId,
      person_id: conversation.customer?.pipedriveId,
      pinned_to_deal_flag: 1
    })
  }

  // AI-powered conversation summarization
  async summarizeConversation(conversation) {
    // Use OpenAI to analyze conversation
    const messages = conversation.messages.map(m => ({
      role: m.role.toLowerCase(),
      content: m.content
    }))
    
    const analysis = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Analyze this customer service conversation and provide:
1. Primary customer intent
2. Key points discussed (max 5)
3. Specific requirements mentioned
4. Action items for the company
5. Overall sentiment (Positive/Neutral/Negative) and score (1-5)
6. Any concerns or objections raised

Format as JSON.`
          },
          {
            role: 'user',
            content: JSON.stringify(messages)
          }
        ],
        response_format: { type: 'json_object' }
      })
    })
    
    const result = await analysis.json()
    return JSON.parse(result.choices[0].message.content)
  }

  // Automation webhook triggers
  async triggerAutomation(event, data) {
    const automations = {
      deal_created: [
        'send_welcome_email',
        'assign_to_team',
        'create_project_folder'
      ],
      warranty_claim: [
        'notify_warranty_team',
        'check_warranty_validity',
        'schedule_inspection'
      ],
      high_value_deal: [
        'notify_management',
        'assign_senior_rep',
        'expedite_processing'
      ]
    }
    
    const triggers = automations[event] || []
    
    for (const trigger of triggers) {
      try {
        await this.executeAutomation(trigger, data)
      } catch (error) {
        console.error(`Automation ${trigger} failed:`, error)
      }
    }
  }

  // Helper methods for team assignment
  getWarrantySpecialist() {
    // Implement round-robin or availability-based assignment
    return process.env.WARRANTY_SPECIALIST_ID || null
  }

  getSalesRep(location) {
    // Assign based on territory
    return process.env.DEFAULT_SALES_REP_ID || null
  }

  getServiceTechnician(preferred) {
    // Check availability and skills
    return preferred || process.env.DEFAULT_TECH_ID || null
  }

  getWarrantyPeriod(glassType) {
    const periods = {
      'tempered': 5,
      'laminated': 10,
      'insulated': 10,
      'standard': 1
    }
    
    for (const [type, years] of Object.entries(periods)) {
      if (glassType?.toLowerCase().includes(type)) {
        return years
      }
    }
    
    return 2 // default warranty period
  }
}

export default AdvancedPipedriveService