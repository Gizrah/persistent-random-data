import { GenerateBase, GeneratingBase } from './generate-base.model';

interface GeneratingText extends GeneratingBase {
  minWords?: number;
  maxWords?: number;
  minSentences?: number;
  maxSentences?: number;
  minBlocks?: number;
  maxBlocks?: number;
}

/**
 * Generate a string, specifically any type of text block. Can be used to create
 * one or more words, one or more sentences or one or more paragraphs of Lorem
 * Ipsum text.
 */
export class GenerateText extends GenerateBase implements GeneratingText {
  /**
   * Minimum amount of words to generate.
   */
  public minWords?: number;

  /**
   * Maximum amount of words to generate.
   */
  public maxWords?: number;

  /**
   * Minimum amount of sentences to generate.
   */
  public minSentences?: number;

  /**
   * Maximum amount of sentences to generate.
   */
  public maxSentences?: number;

  /**
   * Minimum amount of text blocks to generate.
   */
  public minBlocks?: number;

  /**
   * Minimum amount of text blocks to generate.
   */
  public maxBlocks?: number;

  constructor(generate?: GeneratingText) {
    super('GenerateText');
    if (generate) {
      Object.assign(this, generate);
    }
  }

}
