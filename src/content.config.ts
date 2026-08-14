import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const entries = defineCollection({
  loader: glob({
    base: './content-zh',
    pattern: ['*/*.md'],
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

// 渲染试验田:repo 内手维护的 fixture,与 sync 产物 content-zh/ 无关;
// 不进 sections.yaml,首页/搜索/vault 索引均不可见,只挂 /playground/ 路由。
const playground = defineCollection({
  loader: glob({
    base: './playground',
    pattern: ['*.md'],
  }),
  schema: z.object({
    title: z.string(),
  }),
});

// 词汇表:repo 内手维护的术语译法约定,与 playground 同模式;
// 不进 sections.yaml,首页/搜索/vault 索引均不可见,只挂 /glossary/ 路由。
const glossary = defineCollection({
  loader: glob({
    base: './glossary',
    pattern: ['*.md'],
  }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { entries, playground, glossary };
