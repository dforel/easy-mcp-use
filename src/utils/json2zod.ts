import { ToolInputSchemaBase, ZodObjectAny } from '@langchain/core/dist/tools/types';
import { z } from 'zod';

/**
 * 将 JSON Schema 转换为 Zod 验证模式
 * @param schema JSON Schema 对象
 * @returns Zod 验证模式
 */
export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  // 处理基本类型
  if (schema.type === 'string') {
    let zodType = z.string();
    if (schema.description) {
      zodType = zodType.describe(schema.description);
    }
    return zodType;
  } else if (schema.type === 'number') {
    let zodType = z.number();
    if (schema.description) {
      zodType = zodType.describe(schema.description);
    }
    return zodType;
  } else if (schema.type === 'boolean') {
    let zodType = z.boolean();
    if (schema.description) {
      zodType = zodType.describe(schema.description);
    }
    return zodType;
  } else if (schema.type === 'null') {
    let zodType = z.null();
    if (schema.description) {
      zodType = zodType.describe(schema.description);
    }
    return zodType;
  } else if (schema.type === 'array') {
    // 处理数组类型
    let zodType;
    if (schema.items) {
      zodType = z.array(jsonSchemaToZod(schema.items));
    } else {
      zodType = z.array(z.any());
    }
    if (schema.description) {
      zodType = zodType.describe(schema.description);
    }
    return zodType;
  } else if (schema.type === 'object') {
    // 处理对象类型
    const shape: Record<string, z.ZodTypeAny> = {};
    
    // 处理属性
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        let zodType = jsonSchemaToZod(value as any);
        
        // 添加描述信息
        if ((value as any).description) {
          zodType = zodType.describe((value as any).description);
        }
        
        // 检查是否为必填字段
        if (schema.required && Array.isArray(schema.required) && !schema.required.includes(key)) {
          zodType = zodType.optional();
        }
        
        shape[key] = zodType;
      }
    }
    
    let zodObject = z.object(shape);
    
    // 处理额外属性
    if (schema.additionalProperties) {
        // todo
    } else {
        zodObject.strict();
    }
    
    // 添加对象级别的描述
    if (schema.description) {
      zodObject = zodObject.describe(schema.description);
    }
    
    return zodObject;
  }
  
  // 默认返回 any 类型
  return z.object({});
}

// 转换后的代码字符串表示
export function getZodSchemaString(schema: any): string {
  const zodSchema = jsonSchemaToZod(schema);
  // 这里简化处理，实际上需要更复杂的逻辑来生成准确的字符串表示
  if (schema.type === 'object') {
    let result = 'z.object({\n';
    
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const propType = (value as any).type;
        result += `  ${key}: z.${propType}()`;
        
        // 添加描述信息
        if ((value as any).description) {
          result += `.describe("${(value as any).description}")`;
        }
        
        if (schema.required && Array.isArray(schema.required) && schema.required.includes(key)) {
          // 注意：Zod 中所有属性默认都是必需的，不需要 .required()
        } else {
          result += '.optional()';
        }
        
        result += ',\n';
      }
    }
    
    result += '})';
    
    if (schema.additionalProperties === false) {
      result += '.strict()';
    }
    
    // 添加对象级别的描述
    if (schema.description) {
      result += `.describe("${schema.description}")`;
    }
    
    return result;
  }
  
  return 'z.any()';
}

/**
 * 将 Zod 对象转换为 LangChain 工具可用的 Schema
 * @param zodSchema Zod 对象模式
 * @returns LangChain 工具可用的 Schema
 */
export function zodToLangChainSchema(zodSchema: z.ZodTypeAny): ZodObjectAny {
    // 检查是否已经是 ZodObject 类型
    if (zodSchema instanceof z.ZodObject) {
      return zodSchema as ZodObjectAny;
    }
    
    // 如果是其他 Zod 类型，尝试转换为 ZodObject
    if (zodSchema instanceof z.ZodType) {
      // 对于简单类型，可以创建一个包含单个属性的对象
      return z.object({
        input: zodSchema
      }) as ZodObjectAny;
    }
    
    // 如果无法转换，返回一个默认的空对象模式
    return z.object({}) as ZodObjectAny;
  }
  
  /**
   * 将 jsonSchemaToZod 生成的 Zod 模式转换为 LangChain 工具可用的 Schema
   * @param zodSchema jsonSchemaToZod 生成的 Zod 模式
   * @returns LangChain 工具可用的 Schema
   */
  export function convertJsonSchemaZodToLangChain(zodSchema: z.ZodTypeAny): ZodObjectAny {
    return zodToLangChainSchema(zodSchema);
  }

  

// const zodSchemaString = getZodSchemaString(jsonSchema);
// console.log(zodSchemaString);
// 输出: 
// z.object({
//   rmb: z.number(),
// }).strict()

