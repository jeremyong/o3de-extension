/* eslint-disable @typescript-eslint/naming-convention */
module.exports = grammar({
    name: 'azsl',
    extras: $ => [
        /\s/,
        $.comment,
    ],
    rules: {
        source_file: $ => repeat($._topLevelDeclaration),
        _topLevelDeclaration: $ => choice(
            $.includeStatement,
            $.anyStructuredTypeDefinitionStatement,
            $.variableDeclarationStatement,
            $.attributedFunctionDefinition,
            $.attributedFunctionDeclaration,
            $.attributeSpecifierSequence,
            ';',
            // AZSL extensions
            $.compilerExtensionStatement,
            $.typeAliasingDefinitionStatement,
            $.attributedSrgDefinition,
            $.attributedSrgSemantic,
        ),

        comment: $ => token(choice(
            seq('//', /(\\(.|\r?\n)|[^\\\n])*/),
            seq(
                '/*',
                /[^*]*\*+([^/*][^*]*\*+)*/,
                '/'
            )
        )),

        includeStatement: $ => seq('#include', choice(
            seq('<', $.includeFile, '>'),
            seq('"', $.includeFile, '"'),
        )),
        includeFile: $ => /[^<>"']*/,

        // SRG definitions and semantics
        attributedSrgDefinition: $ => seq(repeat($.attributeSpecifierAny), $.srgDefinition),
        srgDefinition: $ => seq(
            optional('partial'),
            'ShaderResourceGroup',
            $.identifier,
            optional(seq(':', $.identifier)),
            '{', repeat($.srgMemberDeclaration), '}'
        ),
        srgMemberDeclaration: $ => prec(1, choice(
            $.structDefinitionStatement,
            $.attributedFunctionDeclaration,
            $.attributedFunctionDefinition,
            $.variableDeclarationStatement,
            $.enumDefinitionStatement,
            $.typeAliasingDefinitionStatement,
            $.attributeSpecifierAny,
        )),

        attributedSrgSemantic: $ => seq(repeat($.attributeSpecifierAny), $.srgSemantic),
        srgSemantic: $ => seq('ShaderResourceGroupSemantic', $.identifier, $.srgSemanticBodyDeclaration),
        srgSemanticBodyDeclaration: $ => seq(
            '{',
            repeat($.srgSemanticMemberDeclaration),
            '}'
        ),
        srgSemanticMemberDeclaration: $ => choice(
            seq('FrequencyId', '=', $.literal, ';'),
            seq('ShaderVariantFallback', '=', $.literal, ';'),
        ),

        // Expressions
        expression: $ => prec.left(choice(
            $.literal,
            $.idExpression,
            seq('(', $.expressionExt, ')'),
            seq($.expression, '.', $.idExpression),
            seq($.expression, '[', $.expression, ']'),
            seq($.expression, $.argumentList),
            seq($.scalarOrVectorOrMatrixType, $.argumentList),
            seq(prec.right(seq('(', $.type, repeat($.arrayRankSpecifier), ')', $.expression))), // Cast expression
            seq($.expression, $.postfixUnaryOperator),
            seq(prec.right(seq($.prefixUnaryOperator, $.expression))),
            seq($.expression, $.binaryOperator, $.expression),
            seq(prec.right(seq($.expression, '?', $.expressionExt, ':', $.expressionExt))), // Ternary
            seq(prec.right(seq($.expression, $.assignmentOperator, $.expressionExt))),
        )),
        expressionExt: $ => prec.left(choice($.expression, seq($.expressionExt, ',', $.expressionExt))),
        prefixUnaryOperator: $ => choice('+', '-', '!', '~', '++', '--'),
        postfixUnaryOperator: $ => choice('++', '--'),
        binaryOperator: $ => choice('*', '/', '%', '+', '-', '<<', '>>', '<', '>', '<=', '>=', '==', '!=', '&', '^', '|', '&&', '||'),
        assignmentOperator: $ => choice('=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|='),

        idExpression: $ => prec.left(seq(optional(token.immediate('::')), repeat(seq($.identifier, token.immediate('::'))), $.identifier)),
        identifier: $ => /[a-zA-Z0-9_]+/,
        classDefinitionStatement: $ => seq($.classDefinition, ';'),

        argumentList: $ => seq('(', optional(seq($.expression, repeat(seq(',', $.expression)))), ')'),

        variableDeclarationStatement: $ => seq($.variableDeclaration, ';'),
        // variableDeclaration: $ => seq(repeat($.attributeSpecifierAny), repeat($.storageFlag), $.type, $.variableDeclarators),
        variableDeclaration: $ => seq(repeat($.storageFlag), $.type, $.variableDeclarators),
        // variableDeclaration: $ => seq($.type, $.variableDeclarators),
        variableDeclarators: $ => seq($.namedVariableDecorator, repeat(seq(',', $.namedVariableDecorator))),
        namedVariableDecorator: $ => seq(
            $.identifier,
            repeat($.arrayRankSpecifier),
            optional($.hlslSemantic),
            optional($.packOffsetNode),
            optional($.registerAllocation),
            optional($.variableInitializer),
        ),
        arrayRankSpecifier: $ => seq('[', optional($.expression), ']'),
        hlslSemantic: $ => seq(':', choice($.hlslSemanticStream, $.hlslSemanticSystem, $.identifier)),
        hlslSemanticStream: $ => choice(
            /BINOMIAL[0-9]*/,
            /BLENDINDICES[0-9]*/,
            /BLENDWEIGHT[0-9]*/,
            /COLOR[0-9]*/,
            /NORMAL[0-9]*/,
            /POSITION[0-9]*/,
            'POSITIONT',
            /PSIZE[0-9]*/,
            /TANGENT[0-9]*/,
            /TEXCOORD[0-9]*/,
            'FOG',
            /TESSFACTOR[0-9]*/,
            /TEXCOORD[0-9]*/,
            'VFACE',
            /VPOS[0-9]*/,
            /DEPTH[0-9]*/,
        ),
        hlslSemanticSystem: $ => /[sS][vV]_[a-zA-Z]+[0-9]*/,
        packOffsetNode: $ => seq(':', 'packoffset', '(', $.identifier, optional(seq('.', $.identifier)), ')'),
        registerAllocation: $ => seq(':', 'register', '(', $.identifier, ')'),
        variableInitializer: $ => choice(seq('=', $.standardVariableInitializer), $.samplerBodyDeclaration),
        standardVariableInitializer: $ => choice(seq('{', $.arrayElementInitializers, '}'), $.expression),
        arrayElementInitializers: $ => seq(
            $.standardVariableInitializer,
            repeat(seq(',', $.standardVariableInitializer)),
            optional(',')),

        attributeSpecifierAny: $ => prec(1, choice($.attributeSpecifier, $.attributeSpecifierSequence)),
        attributeSpecifier: $ => seq('[', $.attribute, ']'),
        attributeSpecifierSequence: $ => seq('[[', $.attribute, repeat(seq(',', $.attribute)), ']]'),
        attributeArguments: $ => seq($.literal),
        attributeArgumentList: $ => seq('(', repeat1($.attributeArguments),')'),
        attribute: $ => choice(
            seq('global', '::', optional(seq($.identifier, '::')), $.identifier, optional($.attributeArgumentList)),
            seq(optional(seq($.identifier, '::')), $.identifier, optional($.attributeArgumentList))
        ),

        samplerBodyDeclaration: $ => seq('{', repeat($.samplerMemberDeclaration), '}'),
        samplerMemberDeclaration: $ => seq(choice(
            seq('MaxAnisotropy', '=', $.integerLiteral),
            seq(choice('MinFilter', 'MagFilter', 'MipFilter'), '=', $.filterModeEnum),
            seq('ReductionType', '=', $.reductionTypeEnum),
            seq('ComparisonFunc', '=', $.comparisonFunctionEnum),
            seq(choice('AddressU', 'AddressV', 'AddressW'), '=', $.addressModeEnum),
            seq(choice('MinLOD', 'MaxLOD'), '=', $.floatLiteral),
            seq('MipLODBias', '=', $.floatLiteral),
            seq('BorderColor', '=', $.borderColorEnum),
        ), ';'),
        filterModeEnum: $ => choice('Point', 'Linear'),
        reductionTypeEnum: $ => choice('Filter', 'Comparison', 'Minimum', 'Maximum'),
        addressModeEnum: $ => choice('Wrap', 'Mirror', 'Clamp', 'Border', 'MirrorOnce'),
        comparisonFunctionEnum: $ => choice(
            'Never', 'Less', 'Equal', 'LessEqual', 'GreaterEqual', 'NotEqual', 'GreaterEqual', 'Always',
        ),
        borderColorEnum: $ => choice('OpaqueBlack', 'TransparentBlack', 'OpaqueWhite'),

        // User-defined types

        anyStructuredTypeDefinition: $ => choice(
            $.classDefinition,
            $.interfaceDefinition,
            $.structDefinition,
            $.enumDefinition),
        classDefinition: $ => seq('class', $.identifier, optional($.baseList), '{', repeat($.classMemberDeclaration), '}'),
        baseList: $ => seq(':', $.idExpression, repeat(seq(',', $.idExpression))),
        classMemberDeclaration: $ => prec(1, choice(
            $.variableDeclarationStatement,
            $.attributedFunctionDefinition,
            $.attributedFunctionDeclaration,
            // AZSL extensions
            $.typeAliasingDefinitionStatement,
            $.anyStructuredTypeDefinitionStatement,
            $.attributeSpecifierAny,
        )),

        interfaceDefinition: $ => seq('interface', $.identifier, '{', repeat($.interfaceMemberDeclaration), '}'),
        interfaceMemberDeclaration: $ => choice($.attributedFunctionDeclaration, $.associatedTypeDeclaration, $.anyStructuredTypeDefinitionStatement),
        anyStructuredTypeDefinitionStatement: $ => seq(repeat($.attributeSpecifierAny), $.anyStructuredTypeDefinition, ';'),

        structDefinitionStatement: $ => seq($.structDefinition, ';'),
        structDefinition: $ => seq('struct', $.identifier, '{', repeat($.structMemberDeclaration), '}'),
        structMemberDeclaration: $ => prec(1, choice(
            $.variableDeclarationStatement,
            $.attributedFunctionDefinition,
            $.attributedFunctionDeclaration,
            $.anyStructuredTypeDefinitionStatement,
            $.typeAliasingDefinitionStatement,
            $.attributeSpecifierAny,
        )),

        enumDefinitionStatement: $ => seq($.enumDefinition, ';'),
        enumDefinition: $ => seq($.enumKey, $.identifier, '{', repeat($.enumeratorListDefinition), '}'),
        enumKey: $ => seq('enum', optional(choice('class', 'struct'))),
        enumeratorListDefinition: $ => prec.left(seq(
            $.enumeratorDeclarator,
            repeat(seq(',', $.enumeratorDeclarator)), optional(',')
        )),
        enumeratorDeclarator: $ => seq($.identifier, optional(seq('=', $.expression))),

        associatedTypeDeclaration: $ => seq('associatedtype', $.identifier, optional($.genericConstraint), ';'),
        variableDeclarationStatement: $ => seq($.variableDeclaration, ';'),
        attributedFunctionDeclaration: $ => seq(repeat($.attributeSpecifierAny), $.functionDeclaration),
        attributedFunctionDefinition: $ => seq(repeat($.attributeSpecifierAny), $.functionDefinition),
        functionDeclaration: $ => seq($.leadingTypeFunctionSignature, ';'),
        leadingTypeFunctionSignature: $ => seq(
            repeat($.storageFlag),
            $.type,
            optional(seq($.userDefinedType, '::')),
            $.identifier,
            optional($.genericParameterList),
            '(', optional($.functionParams), ')',
            optional('override'),
            // AZSL extension
            optional($.hlslSemantic)
        ),
        genericParameterList: $ => seq('<', $.genericTypeDefinition, repeat(seq(',', $.genericTypeDefinition)), '>'),
        genericTypeDefinition: $ => seq($.identifier, optional($.genericConstraint)),
        genericConstraint: $ => seq(':', $.userDefinedType),
        functionDefinition: $ => seq($.leadingTypeFunctionSignature, $.block),
        functionParams: $ => seq($.functionParam, repeat(seq(',', $.functionParam))),
        functionParam: $ => seq(
            repeat($.attributeSpecifierAny),
            repeat($.storageFlag),
            $.type,
            optional($.identifier),
            repeat($.arrayRankSpecifier),
            optional($.hlslSemantic),
            optional($.packOffsetNode),
            optional($.registerAllocation),
            optional($.variableInitializer),
        ),

        block: $ => seq('{', repeat($.statement), '}'),
        statement: $ => choice(
            $.variableDeclarationStatement,
            $.embeddedStatement,
            $.anyStructuredTypeDefinitionStatement,
        ),
        embeddedStatement: $ => prec.left(choice(
            ';',
            $.block,
            seq($.expressionExt, ';'),

            // Selection
            seq(repeat($.attributeSpecifier), 'if', '(', $.expressionExt, ')', $.embeddedStatement, optional($.elseClause)),
            seq(repeat($.attributeSpecifier), 'switch', '(', $.expressionExt, ')', $.switchBlock),

            // Iteration
            seq(repeat($.attributeSpecifier), 'while', '(', $.expressionExt, ')', $.embeddedStatement),
            seq(repeat($.attributeSpecifier), 'do', $.embeddedStatement, 'while', '(', $.expressionExt, ')', ';'),
            seq(
                repeat($.attributeSpecifier),
                'for',
                '(', optional($.forInitializer), ';',
                optional($.expressionExt), ';',
                optional($.expressionExt), ')', $.embeddedStatement),

            seq('break', ';'),
            seq('continue', ';'),
            seq('discard', ';'),
            seq('return', optional($.expressionExt), ';'),

            // AZSL extensions
            $.compilerExtensionStatement,
            $.typeAliasingDefinitionStatement,
        )),
        elseClause: $ => seq('else', $.embeddedStatement),
        switchBlock: $ => seq('{', repeat($.switchSection), '}'),
        switchSection: $ => prec.left(seq(repeat1($.switchLabel), repeat($.statement))),
        switchLabel: $ => choice(seq('case', $.expression, ':'), seq('default', ':')),
        forInitializer: $ => choice($.variableDeclaration, $.expressionExt),

        // Intrinsics used to debug the AZSL compiler
        compilerExtensionStatement: $ => choice(
            seq('__azslc_print_message', '(', $.stringLiteral, ')', ';'),
            seq('__azslc_print_symbol', '(', choice($.idExpression, $.typeofExpression), ',',
                choice('__azslc_prtsym_fully_qualified', '__azslc_prtsym_least_qualified', '__azslc_prtsym_constint_value'),
                ')', ';'),
        ),
        typeofExpression: $ => seq(
            'typeof', '(',
            choice($.expressionExt, $.type),
            ')',
            optional(seq('::', $.idExpression))
        ),

        typeAliasingDefinitionStatement: $ => choice($.typeAliasStatement, $.typedefStatement),
        typeAliasStatement: $ => seq('typealias', $.identifier, '=', $.type, ';'),
        typedefStatement: $ => seq('typedef', $.type, $.identifier, ';'),

        type: $ => choice($.predefinedType, $.userDefinedType, $.typeofExpression),
        userDefinedType: $ => prec(1, choice($.idExpression, $.anyStructuredTypeDefinition)),
        predefinedType: $ => choice(
            'void',
            $.bufferPredefinedType,
            $.byteAddressBufferTypes,
            $.patchPredefinedType,
            $.matrixType,
            $.genericMatrixPredefinedType,
            $.samplerStatePredefinedType,
            $.scalarType,
            $.streamOutputPredefinedType,
            $.structuredBufferPredefinedType,
            $.texturePredefinedType,
            $.genericTexturePredefinedType,
            $.msTexturePredefinedType,
            $.vectorType,
            $.genericVectorType,
            $.constantBufferTemplated,
            $.otherViewResourceType,
            $.subobjectType,
            $.rtxBuiltInTypes,
        ),
        bufferPredefinedType: $ => seq($.bufferType, '<', $.scalarOrVectorOrMatrixType, '>'),
        byteAddressBufferTypes: $ => choice('ByteAddressBuffer', 'RWByteAddressBuffer', 'RasterizerOrderedByteAddressBuffer'),
        patchPredefinedType: $ => seq(choice('InputPatch', 'OutputPatch'), '<', $.userDefinedType, ',', $.integerLiteral, '>'),
        bufferType: $ => choice('Buffer', 'RWBuffer', 'RasterizerOrderedBuffer'),
        scalarOrVectorOrMatrixType: $ => choice($.scalarType, $.vectorType, $.matrixType),
        scalarType: $ => choice(
            'bool',
            'int',
            'uint',
            'unsigned int',
            'dword',
            'half',
            'float',
            'doublde'
        ),
        vectorType: $ => choice(
            'vector',
            'bool1', 'bool2', 'bool3', 'bool4',
            'int1', 'int2', 'int3', 'int4',
            'uint1', 'uint2', 'uint3', 'uint4',
            'dword1', 'dword2', 'dword3', 'dword4',
            'half1', 'half2', 'half3', 'half4',
            'float1', 'float2', 'float3', 'float4',
            'double1', 'double2', 'double3', 'double4',
        ),
        matrixType: $ => choice(
            'bool1x1', 'bool1x2', 'bool1x3', 'bool1x4',
            'bool2x1', 'bool2x2', 'bool2x3', 'bool2x4',
            'bool3x1', 'bool3x2', 'bool3x3', 'bool3x4',
            'bool4x1', 'bool4x2', 'bool4x3', 'bool4x4',

            'int1x1', 'int1x2', 'int1x3', 'int1x4',
            'int2x1', 'int2x2', 'int2x3', 'int2x4',
            'int3x1', 'int3x2', 'int3x3', 'int3x4',
            'int4x1', 'int4x2', 'int4x3', 'int4x4',

            'uint1x1', 'uint1x2', 'uint1x3', 'uint1x4',
            'uint2x1', 'uint2x2', 'uint2x3', 'uint2x4',
            'uint3x1', 'uint3x2', 'uint3x3', 'uint3x4',
            'uint4x1', 'uint4x2', 'uint4x3', 'uint4x4',

            'dword1x1', 'dword1x2', 'dword1x3', 'dword1x4',
            'dword2x1', 'dword2x2', 'dword2x3', 'dword2x4',
            'dword3x1', 'dword3x2', 'dword3x3', 'dword3x4',
            'dword4x1', 'dword4x2', 'dword4x3', 'dword4x4',

            'half1x1', 'half1x2', 'half1x3', 'half1x4',
            'half2x1', 'half2x2', 'half2x3', 'half2x4',
            'half3x1', 'half3x2', 'half3x3', 'half3x4',
            'half4x1', 'half4x2', 'half4x3', 'half4x4',

            'float1x1', 'float1x2', 'float1x3', 'float1x4',
            'float2x1', 'float2x2', 'float2x3', 'float2x4',
            'float3x1', 'float3x2', 'float3x3', 'float3x4',
            'float4x1', 'float4x2', 'float4x3', 'float4x4',

            'double1x1', 'double1x2', 'double1x3', 'double1x4',
            'double2x1', 'double2x2', 'double2x3', 'double2x4',
            'double3x1', 'double3x2', 'double3x3', 'double3x4',
            'double4x1', 'double4x2', 'double4x3', 'double4x4',
        ),
        genericMatrixPredefinedType: $ => seq(
            'matrix', '<', $.scalarType, ',', $.integerLiteral, ',', $.integerLiteral, '>'
        ),
        samplerStatePredefinedType: $ => choice(
            'sampler', 'Sampler', 'SamplerState', 'SamplerComparisonState',
        ),
        streamOutputPredefinedType: $ => seq(
            choice('PointStream', 'LineStream', 'TriangleStream'),
            '<', $.type, '>'
        ),
        structuredBufferPredefinedType: $ => seq(
            choice('AppendStructuredBuffer', 'ConsumeStructuredBuffer', 'RWStructuredBuffer', 'StructuredBuffer', 'RasterizerOrderedStructuredBuffer'),
            '<', $.type, '>'
        ),
        texturePredefinedType: $ => choice(
            'Texture1D', 'Texture1DArray', 'RasterizerOrderedTexture1D', 'RasterizerOrderedTexture1DArray',
            'Texture2D', 'Texture2DArray', 'RasterizerOrderedTexture2D', 'RasterizerOrderedTexture2DArray',
            'Texture3D', 'RasterizerOrderedTexture3D',
            'TextureCube', 'TextureCubeArray',
            'RWTexture1D', 'RWTexture1DArray',
            'RWTexture2D', 'RWTexture2DArray',
            'RWTexture3D',
            'SubpassInput', 'SubpassInputMS'
        ),
        genericTexturePredefinedType: $ => seq($.texturePredefinedType, '<', choice($.scalarType, $.vectorType), '>'),
        msTexturePredefinedType: $ => seq(
            choice('Texture2DMS', 'Texture2DMSArray'),
            '<', choice($.scalarType, $.vectorType), optional(seq(',', $.integerLiteral)), '>'
        ),
        genericVectorType: $ => seq(
            'vector', '<', $.scalarType, ',', $.integerLiteral, '>'
        ),
        constantBufferTemplated: $ => seq(
            choice('ConstantBuffer', 'constantBuffer'),
            '<', $.type, '>'
        ),
        otherViewResourceType: $ => 'RaytracingAccelerationStructure',
        subobjectType: $ => choice(
            'StateObjectConfig',
            'LocalRootSignature',
            'GlobalRootSignature',
            'SubobjectToExportsAssociation',
            'RaytracingShaderConfig',
            'RaytracingPipelineConfig',
            'RaytracingPipelineConfig1',
            'TriangleHitGroup',
            'ProceduralPrimitiveHitGroup',
        ),
        rtxBuiltInTypes: $ => choice('BuiltInTriangleIntersectionAttributes', 'RayDesc'),

        storageFlag: $ => choice(
            // Type modifiers
            'const',
            'row_major',
            'column_major',

            // Storage classes
            'extern',
            'inline',
            'rootconstant',
            'option',
            'precise',
            'shared',
            'groupshared',
            'static',
            'uniform',
            'volatile',

            // Interpolation modifiers
            'linear',
            'centroid',
            'nointerpolation',
            'noperspective',
            'sample',

            // Function parameter modifiers
            'in',
            'out',
            'inout',
            'in out',

            // Geometry shader primitive line
            'point',
            'line',
            'triangle',
            'lineadj',
            'triangleadj',
        ),

        // Tokens
        literal: $ => choice('true', 'false', $.floatLiteral, $.integerLiteral, $.stringLiteral),

        // Float literal specification
        // https://docs.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-appendix-grammar#floating-point-numbers
        floatLiteral: $ => {
            const sign = /[-\+]/;
            const floatingSuffix = /[hHflFL]/;
            const decimalSequence = /[0-9]+/;
            const hexSequence = /[0-9a-fA-F]+/;
            return token(seq(
                optional(sign),
                seq(decimalSequence, optional(seq('.', optional(decimalSequence)))),
                optional(seq(
                    /[eE]/,
                    optional(seq(optional(sign), hexSequence))
                )),
                optional(floatingSuffix)
            ));
        },

        // Integer literal
        integerLiteral: $ => {
            const hexadecimalLiteral = /(0x|0X)[0-9a-fA-F]+((UL)|(LU)|(ul)|(lu)|U|u|L|l)?/;
            const decimalLiteral = /[0-9]+((UL)|(LU)|(ul)|(lu)|U|u|L|l)?/;
            return token(choice(decimalLiteral, hexadecimalLiteral));
        },

        // String literal
        stringLiteral: $ => seq(
            '"',
            repeat(choice(
                token.immediate(prec(1, /[^\\"\n]+/)),
                $.escapeSequence
            )),
            '"',
        ),
        escapeSequence: $ => token.immediate(seq(
            '\\', /['"?abfnrtv\\]/)),
    }
});