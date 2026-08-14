---
title: 渲染试验田:数学、代码与边界情况
---

本页是渲染管线的试验田:集中放置词条会用到的全部排版 case,改管线或样式后肉眼回归用。文件在 repo 的 `playground/rendering.md`,手维护,不进 vault、不进大纲。

## 行内数学

向量的加法定义为逐分量相加:$\mathbf{a} + \mathbf{b} = (a_1 + b_1, \dots, a_n + b_n)$,其中 $\mathbf{a}, \mathbf{b} \in \mathbb{R}^n$。标量 $c = 2.5$ 乘向量 $\mathbf{x}$ 写作 $c\mathbf{x}$。希腊字母 $\alpha, \beta, \lambda, \sigma, \epsilon$ 与粗体 $\mathbf{w}^T \mathbf{x} + b$ 混排。

## 展示数学:矩阵与分段

列向量与矩阵:

$$
\mathbf{x} = \begin{pmatrix} x_1 \\ x_2 \\ \vdots \\ x_n \end{pmatrix}, \qquad
A = \begin{bmatrix} a_{11} & a_{12} & \cdots & a_{1n} \\ a_{21} & a_{22} & \cdots & a_{2n} \\ \vdots & \vdots & \ddots & \vdots \\ a_{m1} & a_{m2} & \cdots & a_{mn} \end{bmatrix}
$$

分段函数(cases 环境):

$$
\mathrm{ReLU}(x) = \begin{cases} x, & x > 0 \\ 0, & x \le 0 \end{cases}
$$

## 展示数学:多行对齐与长公式

align 环境(algebrica 语料里出现 521 次的重灾区):

$$
\begin{align}
\frac{\partial L}{\partial w_j} &= \frac{\partial}{\partial w_j} \frac{1}{2}(y - \hat{y})^2 \\
&= -(y - \hat{y}) \cdot \frac{\partial \hat{y}}{\partial w_j} \\
&= -(y - \hat{y}) \cdot x_j
\end{align}
$$

长公式溢出测试(softmax 的完整展开):

$$
\mathrm{softmax}(z_i) = \frac{\exp(z_i)}{\sum_{j=1}^{K} \exp(z_j)} = \frac{\exp(z_i)}{\exp(z_1) + \exp(z_2) + \cdots + \exp(z_K)}, \quad i = 1, 2, \dots, K
$$

求和、积分与极限:

$$
\sum_{i=1}^{n} x_i, \qquad \int_0^1 x^2 \, dx = \frac{1}{3}, \qquad \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$

## 代码块:Python

训练循环(numpy 风格,含中文注释与较长的行):

```python
import numpy as np

def softmax(z: np.ndarray) -> np.ndarray:
    """数值稳定版 softmax:先减最大值再取指数,防止 exp 上溢。"""
    z = z - np.max(z, axis=-1, keepdims=True)
    e = np.exp(z)
    return e / np.sum(e, axis=-1, keepdims=True)

logits = np.array([2.0, 1.0, 0.1, -1.0, 3.5, 0.0, -0.7, 1.2, 0.3, -2.1])
probs = softmax(logits)
print("sum =", probs.sum())  # 应当精确等于 1.0(浮点误差内)
```

## 代码块:输出与无语言围栏

程序输出通常不带语言标记,渲染为等宽纯文本:

```
epoch 1/5  train_loss=0.3423  test_acc=0.9543
epoch 2/5  train_loss=0.1612  test_acc=0.9658
epoch 3/5  train_loss=0.1127  test_acc=0.9701
```

shell 会话:

```bash
uv run --with numpy python vectors_basics.py
npm run sync && npm test && npm run build
```

行内代码:命令 `npm run sync`、文件名 `sections.yaml`、变量 `learning_rate` 与数学 $x_1$ 混排。

## 长行与横向滚动

```python
# 下面这行故意很长,用来测试代码块的横向滚动与换行行为是否把版面撑破
weights = np.random.randn(784, 128) * np.sqrt(2.0 / 784)  # He 初始化:方差 = 2/fan_in,保持前向传播时激活值的方差不随层数衰减或爆炸,这行注释非常非常非常非常非常非常长
```

## 链接与降级

指向已毕业词条的站内链接:[范畴](../categories/category/)。指向未毕业词条(known_absent)的链接渲染为纯文本:[函子](../functors/functor/)。

## 插图

词条插图走 vault `svg/` 同步机制;本页不在 content-zh 章节布局内,rewrite 插件推断不出章节,故直接引用绝对路径。测试点:居中(`p > img:only-child`)、alt 经 sanitize 保留、SVG 内中文与数学斜体标签:

![测试插图:细灰轴线、墨色箭头与中文标签](/assets/playground/svg/test-1.svg)

## 引用块

sync 会把 Obsidian callout 标记剥成普通 blockquote:

> **定义(向量空间)**:设 $V$ 是一个集合,其上定义了加法与标量乘法两种运算。若这两种运算满足八条公理,则称 $V$ 是域 $F$ 上的向量空间。
>
> 引用块的第二段,测试多段引用与数学 $\mathbb{R}^n$ 的混排。

## Tufte 教学布局

页边图只承载紧邻正文的小型辅助图。桌面端进入 240 px 页边,移动端与打印回到正文流。

> [!marginfigure] 纸墨主题示意
> ![暖纸上的细灰轴线与墨色箭头](/assets/playground/svg/test-1.svg)

通栏表格只用于正文列不足以表达的比较,窄屏时只允许表格容器横向滚动。

> [!fullwidth] 布局能力比较
> | 能力 | 桌面 | 移动与打印 |
> | --- | --- | --- |
> | 页边图 | 进入 240 px 页边 | 回到正文流 |
> | 通栏表格 | 使用正文与页边总宽 | 容器内滚动或适配纸宽 |

> [!epigraph]
> 先说明问题,再选择模型。
>
> ——本项目渲染试验田

## 旁注

同一段包含两个编号旁注:第一条对应局部术语[^sidenote-first],第二条继续验证同段堆叠顺序[^sidenote-second]。桌面端两条旁注应进入右侧页边并依次向下排列;移动端应在各自引用之后始终显示。

行内数学旁注验证公式 $\lVert x \rVert_2$ 与正文基线[^sidenote-math]。

> [!marginnote] 符号提醒
> 无编号边注使用独立标签,不占用编号序列;桌面进入页边,移动端紧邻本段显示。

下一段验证旁注中的站内链接[^sidenote-link],同时观察相邻段落的页边内容是否保持文档顺序。

[^sidenote-first]: 第一条编号旁注用于验证局部锚点、页边起点和返回链接。
[^sidenote-second]: 第二条编号旁注故意与第一条位于同一段,用于验证页边内容按引用顺序堆叠,且不覆盖后续正文。
[^sidenote-math]: 行内数学 $\lVert x \rVert_2 = \sqrt{x^T x}$ 应保持行内尺寸,不触发展示公式布局。
[^sidenote-link]: 站内链接应继续经过统一改写与部署前缀处理,例如[范畴](../categories/category/)。

## 列表与表格

无序列表:

- 向量是数组:程序员视角,`float x[784]`
- 向量是位移:几何视角,箭头可以平移
- 向量是可以做加法和数乘的东西:抽象视角

有序列表:

1. 交换律:$\mathbf{a} + \mathbf{b} = \mathbf{b} + \mathbf{a}$
2. 结合律:$(\mathbf{a} + \mathbf{b}) + \mathbf{c} = \mathbf{a} + (\mathbf{b} + \mathbf{c})$
3. 零向量:$\mathbf{a} + \mathbf{0} = \mathbf{a}$

表格(数学与代码混排):

| 记号 | 含义 | 代码对应 |
|---|---|---|
| $\mathbf{x} \in \mathbb{R}^n$ | $n$ 维实向量 | `np.ndarray`,shape `(n,)` |
| $\mathbf{a} \odot \mathbf{b}$ | Hadamard 积 | `a * b` |
| $\mathbf{a}^T \mathbf{b}$ | 点积 | `a @ b` |
