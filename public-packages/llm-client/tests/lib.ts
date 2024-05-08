import { createLLMClient } from "@/index"
import { omit } from "@/lib"
import { OpenAILikeClient } from "@/types"
import { describe, expect, test } from "bun:test"

export async function createTestCase(client: OpenAILikeClient, model: string) {
  return new Promise<void>(resolve => {
    describe(`LLMClient ${client.name} Provider - ${model}`, () => {
      test("Function Calling standard", async () => {
        const completion = await client.chat.completions.create({
          model,
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: "My name is Dimitri Kennedy."
            }
          ],
          tool_choice: {
            type: "function",
            function: {
              name: "say_hello"
            }
          },
          tools: [
            {
              type: "function",
              function: {
                name: "say_hello",
                description: "Say hello",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string"
                    }
                  },
                  required: ["name"],
                  additionalProperties: false
                }
              }
            }
          ]
        })

        //@ts-expect-error fails because its optionally undefiened, which is fine - if we fail we fail
        expect(omit(["id"], completion?.choices?.[0]?.message.tool_calls?.[0])).toEqual({
          type: "function",
          function: {
            name: "say_hello",
            arguments: '{"name":"Dimitri Kennedy"}'
          }
        })
      })

      test("Function Calling complex schema", async () => {
        const completion = await client.chat.completions.create({
          model,
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `User Data Submission:

          First Name: John
          Last Name: Doe
          Contact Details:
          Email: john.doe@example.com
          Phone Number: 555-1234
          Job History:

          Company Name: Acme Corp
          Role: Software Engineer
          Years: 5
          Company Name: Globex Inc.
          Role: Lead Developer
          Years: 3
          Skills:

          Programming
          Leadership
          Communication`
            }
          ],
          tool_choice: {
            type: "function",
            function: {
              name: "process_user_data"
            }
          },
          tools: [
            {
              type: "function",
              function: {
                name: "process_user_data",
                description: "Processes user data, including personal and professional details.",
                parameters: {
                  type: "object",
                  properties: {
                    userDetails: {
                      type: "object",
                      properties: {
                        firstName: {
                          type: "string"
                        },
                        lastName: {
                          type: "string"
                        },
                        contactDetails: {
                          type: "object",
                          properties: {
                            email: {
                              type: "string"
                            },
                            phoneNumber: {
                              type: "string"
                            }
                          },
                          required: ["email"]
                        }
                      },
                      required: ["firstName", "lastName", "contactDetails"]
                    },
                    jobHistory: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          companyName: {
                            type: "string"
                          },
                          role: {
                            type: "string"
                          },
                          years: {
                            type: "number"
                          }
                        },
                        required: ["companyName", "role"]
                      }
                    },
                    skills: {
                      type: "array",
                      items: {
                        type: "string"
                      }
                    }
                  },
                  required: ["userDetails", "jobHistory"],
                  additionalProperties: false
                }
              }
            }
          ]
        })

        //@ts-expect-error fails because its optionally undefiened, which is fine - if we fail we fail
        expect(omit(["id"], completion?.choices?.[0]?.message.tool_calls?.[0])).toEqual({
          type: "function",
          function: {
            name: "process_user_data",
            arguments: JSON.stringify({
              userDetails: {
                firstName: "John",
                lastName: "Doe",
                contactDetails: {
                  email: "john.doe@example.com",
                  phoneNumber: "555-1234"
                }
              },
              jobHistory: [
                {
                  companyName: "Acme Corp",
                  role: "Software Engineer",
                  years: 5
                },
                {
                  companyName: "Globex Inc.",
                  role: "Lead Developer",
                  years: 3
                }
              ],
              skills: ["Programming", "Leadership", "Communication"]
            })
          }
        })
      })

      test("Standard stream", async () => {
        const completion = await client.chat.completions.create({
          model,
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: "What is the capital of France?"
            }
          ]
        })

        expect((completion?.choices ?? [])[0].message.content).toInclude("Paris")
      })
    })

    test("Standard stream - beg for json", async () => {
      const completion = await client.chat.completions.create({
        model,
        stream: true,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content: `
            always return your response in strict, stringified json format and no other prose, using the following JSON schema:
             {
               type: "object",
               properties: {
                 content: {
                   type: "string",
                   description: "your response to the user"
                 }
               },
               required: ["content"],
               additionalProperties: false
             }
           `
          },
          {
            role: "user",
            content: "what is the capital of france?"
          }
        ]
      })

      let final = ""
      for await (const message of completion) {
        final += message.choices?.[0].delta?.content ?? ""
      }
      console.log(final)
      expect(final).toBeString()
    })

    resolve()
  })
}
